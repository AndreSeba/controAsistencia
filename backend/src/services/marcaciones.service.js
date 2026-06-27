const { getPool } = require('../config/db');
const marcacionesRepo = require('../repositories/marcaciones.repository');
const turnosRepo = require('../repositories/turnos.repository');
const qrTokenRepo = require('../repositories/qrToken.repository');
const biometriaRepo = require('../repositories/biometria.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');
const livenessService = require('./liveness.service');
const sucursalesService = require('./sucursales.service');
const cifradoService = require('./cifrado.service');
const faceMatchService = require('./faceMatch.service');
const almacenamientoService = require('./almacenamiento.service');
const descuentosService = require('./descuentos.service');
const configuracionService = require('./configuracion.service');
const horarioUtil = require('../utils/horario.util');
const geocercaUtil = require('../utils/geocerca.util');

const UMBRAL_REVISION_ATRASO_MIN = 60; // P9: > 60 min => requiere_revision (no automático en el monto)

class MarcacionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function registrar({
  empleadoId,
  sucursalId,
  deviceToken,
  qrToken,
  livenessNonce,
  selfieBuffer,
  selfieMimetype,
  gpsLat,
  gpsLng,
  gpsPrecisionM,
  tipoSolicitado,
}) {
  if (!selfieBuffer?.length) throw new MarcacionError('selfie es requerida');

  const sucursal = await sucursalesService.obtenerOFallar(sucursalId);
  const timestampUtc = new Date();

  const pool = getPool();
  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    const qr = await qrTokenRepo.buscarVigentePorToken(qrToken, client);
    if (!qr || qr.sucursal_id !== sucursalId) {
      throw new MarcacionError('Código QR inválido o expirado', 401);
    }

    const liveness = await livenessService.validarYConsumir(livenessNonce, empleadoId, client);

    const biometria = await biometriaRepo.buscarActivoPorEmpleado(empleadoId);
    let faceMatchScore = null;
    let identidadVerificada = false;
    if (biometria) {
      const template = cifradoService.descifrar(biometria.face_template_cifrado);
      const comparacion = await faceMatchService.comparar(selfieBuffer, template);
      faceMatchScore = comparacion.score;
      identidadVerificada = comparacion.match;
    }

    const dentroGeocerca = geocercaUtil.dentroDeGeocerca(
      gpsLat, gpsLng, sucursal.geo_lat, sucursal.geo_lng, sucursal.geo_radio_m
    );

    const jornadaAbierta = await turnosRepo.buscarAbiertaPorEmpleado(empleadoId, client);
    const tipo = jornadaAbierta ? 'SALIDA' : 'ENTRADA';

    // El empleado elige Entrada/Salida en la PWA, pero el servidor manda: si lo que
    // pidió no coincide con el estado real de su jornada, se rechaza con un mensaje
    // claro en vez de aceptar en silencio el tipo "correcto" (server-authoritative).
    if (tipoSolicitado && tipoSolicitado !== tipo) {
      const mensaje = tipo === 'SALIDA'
        ? 'Ya tenés una entrada sin cerrar. Marcá salida.'
        : 'No hay una entrada abierta para marcar salida.';
      throw new MarcacionError(mensaje, 409);
    }

    let turnoJornadaId;
    let minutosAtraso = null;
    let minutosAnticipacion = null;
    if (tipo === 'ENTRADA') {
      const catalogos = await turnosRepo.listarCatalogo();
      const turno = horarioUtil.atribuirTurno(timestampUtc, catalogos);
      const fecha = horarioUtil.fechaLocal(timestampUtc);
      turnoJornadaId = await turnosRepo.crear(
        { empleadoId, sucursalId, fecha, turnoCatalogoId: turno.id },
        client
      );
      minutosAtraso = horarioUtil.calcularMinutosAtraso(timestampUtc, turno);
      minutosAnticipacion = horarioUtil.calcularMinutosAnticipacion(timestampUtc, turno);
    } else {
      turnoJornadaId = jornadaAbierta.id;
    }

    const selfieUrl = await almacenamientoService.guardar('marcaciones', selfieBuffer, selfieMimetype);

    // Señal blanda (P-geocerca/identidad) + P9 (atraso > 60 min) + margen de
    // anticipación configurable: nunca bloquea, solo marca para revisión de RRHH.
    const margenAnticipacionMin = await configuracionService.obtenerMargenAnticipacion();
    const atrasoExcesivo = minutosAtraso != null && minutosAtraso > UMBRAL_REVISION_ATRASO_MIN;
    const demasiadoTemprano = minutosAnticipacion != null && minutosAnticipacion > margenAnticipacionMin;
    const estado = (!identidadVerificada || !dentroGeocerca || atrasoExcesivo || demasiadoTemprano)
      ? 'requiere_revision'
      : 'registrada';

    const marcacion = await marcacionesRepo.crear({
      empleadoId,
      turnoJornadaId,
      sucursalId,
      deviceToken,
      tipo,
      timestampUtc,
      gpsLat: gpsLat ?? null,
      gpsLng: gpsLng ?? null,
      gpsPrecisionM: gpsPrecisionM ?? null,
      dentroGeocerca,
      geoCentroLatAplicado: sucursal.geo_lat,
      geoCentroLngAplicado: sucursal.geo_lng,
      geoRadioAplicado: sucursal.geo_radio_m,
      qrTokenId: qr.id,
      selfieUrl,
      livenessOk: liveness.livenessOk,
      livenessRetoId: liveness.livenessRetoId,
      faceMatchScore,
      identidadVerificada,
      minutosAtraso,
      minutosAnticipacion,
      estado,
    }, client);

    if (tipo === 'ENTRADA') {
      await descuentosService.calcularParaEntrada({
        marcacionId: marcacion.id,
        empleadoId,
        minutosAtraso,
        periodo: horarioUtil.fechaLocal(timestampUtc).slice(0, 7),
      }, client);
    }

    if (tipo === 'SALIDA') {
      await turnosRepo.cerrar(turnoJornadaId, {
        salidaMarcada: true,
        cierreAutomatico: false,
        requiereRevision: estado === 'requiere_revision',
      }, client);
    }

    await client.query('COMMIT');
    return marcacion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listar(filtros) {
  return marcacionesRepo.listar(filtros);
}

async function marcarRevisado(id, usuarioId, ip) {
  const marcacion = await marcacionesRepo.obtenerPorId(id);
  if (!marcacion) throw new MarcacionError('Marcación no encontrada', 404);
  if (marcacion.estado !== 'requiere_revision') {
    throw new MarcacionError('Esta marcación no está marcada para revisión', 409);
  }
  if (marcacion.revisado) {
    throw new MarcacionError('Esta marcación ya fue revisada', 409);
  }

  const actualizada = await marcacionesRepo.marcarRevisado(id, usuarioId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'revisar_marcacion',
    tabla: 'marcacion',
    registroId: id,
    ip,
    detalle: { empleadoId: marcacion.empleado_id, sucursalId: marcacion.sucursal_id, tipo: marcacion.tipo },
  });

  return actualizada;
}

module.exports = { registrar, listar, marcarRevisado, MarcacionError };
