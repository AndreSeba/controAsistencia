const { getPool } = require('../config/db');
const marcacionesRepo = require('../repositories/marcaciones.repository');
const turnosRepo = require('../repositories/turnos.repository');
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
const { TOTP } = require('totp-generator');

const UMBRAL_REVISION_ATRASO_MIN = 60; // P9: > 60 min => requiere_revision (no automático en el monto)

// Online: entre escanear el QR y terminar selfie+envío pasan hasta ~2,5 min; se aceptan
// tokens de ventanas recientes (y +30s por desfase de reloj del kiosko).
const TOLERANCIA_ONLINE_MS = [30000, 0, -30000, -60000, -90000, -120000, -150000];
// Offline: el token debe corresponder al momento declarado del escaneo (±1 ventana).
const TOLERANCIA_OFFLINE_MS = [30000, 0, -30000];
const MAX_ANTIGUEDAD_OFFLINE_MS = 48 * 60 * 60 * 1000;
const MAX_FUTURO_OFFLINE_MS = 5 * 60 * 1000;

class MarcacionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// totp-generator v2: TOTP.generate es async — sin await, otp queda undefined y
// toda comparación falla en silencio. No quitar los await.
async function totpCoincide(secret, token, timestampMs, offsets) {
  try {
    for (const offset of offsets) {
      const { otp } = await TOTP.generate(secret, { digits: 6, period: 30, timestamp: timestampMs + offset });
      if (otp === token) return true;
    }
    return false;
  } catch (e) {
    // La librería lanza si el secreto no es base32 válido (p.ej. secretos hex de una
    // versión vieja). Sin este catch sería un 500 "Error interno" sin pista alguna.
    throw new MarcacionError(
      'El código QR de esta sucursal está mal configurado. Abrí la pantalla de la sucursal de nuevo desde el panel para regenerarlo.',
      409
    );
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
  offlineMode,
  timestampOffline,
}) {
  if (!selfieBuffer?.length) throw new MarcacionError('selfie es requerida');

  const sucursal = await sucursalesService.obtenerOFallar(sucursalId);
  const timestampUtc = offlineMode && timestampOffline ? new Date(timestampOffline) : new Date();

  const pool = getPool();
  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    // Ambos caminos validan el TOTP contra el secreto de la sucursal, del lado del
    // servidor. La tabla qr_token quedó obsoleta con el cambio a TOTP (nadie la puebla).
    if (!sucursal.totp_secret) {
      throw new MarcacionError('La sucursal no tiene código QR configurado. Abrí la pantalla de la sucursal una vez para generarlo.', 409);
    }

    if (offlineMode) {
      // El timestamp declarado por el cliente solo se acepta dentro de una ventana
      // razonable: sin esto, una marca "offline" podría fecharse en cualquier momento.
      const ahoraMs = Date.now();
      const tsMs = timestampUtc.getTime();
      if (Number.isNaN(tsMs) || tsMs > ahoraMs + MAX_FUTURO_OFFLINE_MS || tsMs < ahoraMs - MAX_ANTIGUEDAD_OFFLINE_MS) {
        throw new MarcacionError('Marcación offline con fecha fuera del rango aceptado (máx. 48h)', 422);
      }
      if (!(await totpCoincide(sucursal.totp_secret, qrToken, tsMs, TOLERANCIA_OFFLINE_MS))) {
        throw new MarcacionError('Código QR (TOTP) inválido o expirado', 401);
      }
    } else if (!(await totpCoincide(sucursal.totp_secret, qrToken, timestampUtc.getTime(), TOLERANCIA_ONLINE_MS))) {
      throw new MarcacionError('Código QR inválido o expirado', 401);
    }

    let liveness = { livenessOk: false, livenessRetoId: null };
    if (!offlineMode) {
      liveness = await livenessService.validarYConsumir(livenessNonce, empleadoId, client);
    }

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
      if (!turno) {
        // Catálogo de turnos vacío: sin esto, turno.id revienta con un 500 sin pista.
        throw new MarcacionError('No hay turnos configurados en el sistema. Avisá a RRHH.', 409);
      }
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
    // Offline siempre va a revisión: el timestamp lo declara el cliente y no hubo
    // reto de liveness — confianza reducida por diseño, RRHH la confirma a mano.
    const margenAnticipacionMin = await configuracionService.obtenerMargenAnticipacion();
    const atrasoExcesivo = minutosAtraso != null && minutosAtraso > UMBRAL_REVISION_ATRASO_MIN;
    const demasiadoTemprano = minutosAnticipacion != null && minutosAnticipacion > margenAnticipacionMin;
    const estado = (offlineMode || !identidadVerificada || !dentroGeocerca || atrasoExcesivo || demasiadoTemprano)
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
      qrTokenId: null,
      selfieUrl,
      livenessOk: liveness.livenessOk,
      livenessRetoId: liveness.livenessRetoId,
      faceMatchScore,
      identidadVerificada,
      minutosAtraso,
      minutosAnticipacion,
      estado,
      offlineMode,
      totpToken: qrToken,
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
