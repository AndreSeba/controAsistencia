const { getPool } = require('../config/db');
const marcacionesRepo = require('../repositories/marcaciones.repository');
const turnosRepo = require('../repositories/turnos.repository');
const empleadosRepo = require('../repositories/empleados.repository');
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

// El empleado elige Entrada/Salida en la PWA, pero el servidor manda: si lo que pidió
// no coincide con el estado real de su jornada, se rechaza con un mensaje claro en vez
// de aceptar en silencio el tipo "correcto" (server-authoritative).
function verificarTipoSolicitado(tipoSolicitado, tipoReal) {
  if (!tipoSolicitado || tipoSolicitado === tipoReal) return;
  const mensaje = tipoReal === 'SALIDA'
    ? 'Ya tenés una entrada sin cerrar. Marcá salida.'
    : 'No hay una entrada abierta para marcar salida.';
  throw new MarcacionError(mensaje, 409);
}

// El atraso se calcula contra el horario del BLOQUE más cercano del ÁREA del empleado
// si tiene una asignada. Fallback: turno+bloque más cercano a la hora de llegada, para
// empleados sin área. Solo lecturas — devuelve null si no se pudo atribuir, sin lanzar:
// el catálogo vacío únicamente es un error si la marcación termina siendo una ENTRADA,
// y eso recién se resuelve dentro de la transacción.
async function resolverAtribucion(empleadoId, timestampUtc) {
  let turno = null;
  let bloque = null;
  const empleado = await empleadosRepo.obtenerPorId(empleadoId);
  if (empleado?.area_turno_id) {
    turno = await turnosRepo.obtenerCatalogoPorId(empleado.area_turno_id);
    if (turno) {
      bloque = horarioUtil.atribuirBloque(timestampUtc, turno.bloques);
    }
  }
  if (!turno) {
    const catalogos = await turnosRepo.listarCatalogo();
    const resultado = horarioUtil.atribuirTurno(timestampUtc, catalogos);
    if (resultado) {
      turno = resultado.turno;
      bloque = resultado.bloque;
    }
  }
  if (!turno || !bloque) return null;
  return { turno, bloque };
}

async function registrar({
  empleadoId,
  sucursalId,
  deviceToken,
  dispositivoCompartido,
  dispositivoSucursalId,
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

  // Bloqueo DURO de sucursal para el celular corporativo compartido: a diferencia del
  // GPS del empleado (señal blanda), este teléfono no se mueve de su sucursal asignada
  // — si el QR escaneado es de otra, se rechaza en vez de mandarlo a revisión.
  if (dispositivoCompartido && dispositivoSucursalId !== sucursalId) {
    throw new MarcacionError('Este dispositivo corporativo está asignado a otra sucursal', 403);
  }

  const sucursal = await sucursalesService.obtenerOFallar(sucursalId);
  const timestampUtc = offlineMode && timestampOffline ? new Date(timestampOffline) : new Date();

  // ── FASE 1 — validaciones baratas, trabajo pesado y lecturas, SIN sostener la
  // conexión de la transacción.
  // El face-match (~3,5s de CPU) y la subida a Storage (red) NO tocan la base, pero
  // antes corrían con el BEGIN abierto: retenían una conexión ~4s cada marcación. Peor
  // todavía, varias lecturas de acá (biometría, empleado, catálogo, configuración) usan
  // el pool, o sea pedían una SEGUNDA conexión sin soltar la primera — con el pool lleno
  // eso no es lentitud sino un DEADLOCK del que no se sale solo (reproducido: 3
  // marcaciones concurrentes con pool de 3 quedan colgadas para siempre).
  // Regla al tocar esto: nada que use getPool() puede correr dentro de la FASE 2.
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

  // Pre-chequeos baratos (liveness vigente + tipo pedido). El veredicto que vale es el
  // de la FASE 2; adelantarlos acá evita gastar el face-match y una subida a Storage en
  // los dos errores más comunes — nonce vencido y tocar Entrada teniendo una jornada
  // abierta (o al revés) —, que si no dejarían una selfie huérfana en el bucket.
  if (!offlineMode) {
    await livenessService.validar(livenessNonce, empleadoId);
  }
  if (tipoSolicitado) {
    const abiertaPrevia = await turnosRepo.buscarAbiertaPorEmpleado(empleadoId);
    verificarTipoSolicitado(tipoSolicitado, abiertaPrevia ? 'SALIDA' : 'ENTRADA');
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
    gpsLat, gpsLng, sucursal.geo_lat, sucursal.geo_lng, sucursal.geo_radio_m, gpsPrecisionM
  );

  const atribucion = await resolverAtribucion(empleadoId, timestampUtc);
  const margenAnticipacionMin = await configuracionService.obtenerMargenAnticipacion();
  const selfieUrl = await almacenamientoService.guardar('marcaciones', selfieBuffer, selfieMimetype);

  // ── FASE 2 — transacción corta: solo escrituras y las lecturas que tienen que ser
  // consistentes con ellas. Todas reciben `client`; ninguna usa getPool() (ver arriba).
  const pool = getPool();
  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    let liveness = { livenessOk: false, livenessRetoId: null };
    if (!offlineMode) {
      liveness = await livenessService.validarYConsumir(livenessNonce, empleadoId, client);
    }

    const jornadaAbierta = await turnosRepo.buscarAbiertaPorEmpleado(empleadoId, client);
    const tipo = jornadaAbierta ? 'SALIDA' : 'ENTRADA';
    verificarTipoSolicitado(tipoSolicitado, tipo);

    let turnoJornadaId;
    let minutosAtraso = null;
    let minutosAnticipacion = null;
    let aplicaDescuento = true; // default
    if (tipo === 'ENTRADA') {
      if (!atribucion) {
        // Catálogo de turnos vacío: sin esto, turno.id revienta con un 500 sin pista.
        throw new MarcacionError('No hay turnos configurados en el sistema. Avisá a RRHH.', 409);
      }
      const { turno, bloque } = atribucion;

      aplicaDescuento = turno.aplica_descuento !== false;

      const fecha = horarioUtil.fechaLocal(timestampUtc);
      turnoJornadaId = await turnosRepo.crear(
        { empleadoId, sucursalId, fecha, turnoCatalogoId: turno.id },
        client
      );
      minutosAtraso = horarioUtil.calcularMinutosAtraso(timestampUtc, bloque);
      minutosAnticipacion = horarioUtil.calcularMinutosAnticipacion(timestampUtc, bloque);
    } else {
      turnoJornadaId = jornadaAbierta.id;
      aplicaDescuento = jornadaAbierta.aplica_descuento !== false;
    }

    // Señal blanda (P-geocerca/identidad) + P9 (atraso > 60 min) + margen de
    // anticipación configurable: nunca bloquea, solo marca para revisión de RRHH.
    // Offline siempre va a revisión: el timestamp lo declara el cliente y no hubo
    // reto de liveness — confianza reducida por diseño, RRHH la confirma a mano.
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

    // Solo generar descuento si el área tiene aplica_descuento = true.
    // El atraso queda registrado en la marcación de todas formas (para reportes).
    if (tipo === 'ENTRADA' && aplicaDescuento) {
      await descuentosService.calcularParaEntrada({
        marcacionId: marcacion.id,
        empleadoId,
        minutosAtraso,
        periodo: horarioUtil.fechaLocal(timestampUtc).slice(0, 7),
      }, client);
    }

    // Área configurada para marcar SOLO Entrada (propuesta 2026-07-30, reabre P7/P9
    // parcialmente): la jornada se cierra en el mismo momento de la Entrada, no se
    // espera al auto-cierre nocturno (P8). Sin esto, cada jornada de estas áreas
    // quedaría ABIERTA todo el día y el job la cerraría con requiere_revision=true —
    // inflando la cola de revisión con el comportamiento esperado, no una anomalía.
    // atraso/descuento/pago por día no cambian: se calculan solo con la Entrada (P7) y
    // por fecha de jornada, no por si hubo salida.
    if (tipo === 'ENTRADA' && atribucion.turno.requiere_salida === false) {
      await turnosRepo.cerrar(turnoJornadaId, {
        salidaMarcada: false,
        cierreAutomatico: false,
        requiereRevision: false,
      }, client);
    }

    if (tipo === 'SALIDA') {
      // El flag de la jornada tiene que reflejar la jornada COMPLETA, no solo la salida.
      // Antes se calculaba con el `estado` de ESTA marcación, así que una ENTRADA con
      // atraso excesivo (o identidad no verificada) dejaba la jornada SIN marcar si la
      // salida salía limpia — RRHH no la veía en el KPI del dashboard, solo filtrando en
      // Marcaciones. Caso real detectado el 2026-07-28: entrada con 116 min de atraso y
      // salida normal → jornada quedaba en requiere_revision = false.
      // La consulta ve la SALIDA recién insertada: corre dentro de la misma transacción.
      const requiereRevision = await marcacionesRepo.existeRequiereRevisionEnJornada(turnoJornadaId, client);
      await turnosRepo.cerrar(turnoJornadaId, {
        salidaMarcada: true,
        cierreAutomatico: false,
        requiereRevision,
      }, client);
    }

    // Aviso de horario partido (2026-07-31): si esta Salida deja un segundo bloque sin
    // marcar, la PWA se lo recuerda al empleado — se detectó en producción que el
    // personal de horario discontinuo a veces olvida volver (solo 2 de las 4 marcaciones
    // esperadas). Puro aviso informativo: no cambia nada del cálculo de atraso/pago.
    const horaBloqueDos = tipo === 'SALIDA'
      ? horarioUtil.bloquePendienteTrasSalida(timestampUtc, atribucion?.turno?.bloques)
      : null;

    await client.query('COMMIT');
    return {
      ...marcacion,
      segundoBloquePendienteHoy: horaBloqueDos != null,
      horaBloqueDos,
    };
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
