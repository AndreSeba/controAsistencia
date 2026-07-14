const visitasRepo = require('../repositories/visitas.repository');
const empleadosRepo = require('../repositories/empleados.repository');
const sucursalesService = require('./sucursales.service');
const geocercaUtil = require('../utils/geocerca.util');
const { TOTP } = require('totp-generator');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
// Mismo criterio que la marcación online: el flujo escanear→enviar puede tardar.
const TOLERANCIA_MS = [30000, 0, -30000, -60000, -90000, -120000, -150000];

class VisitaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function totpCoincide(secret, token, offsets) {
  try {
    const ahora = Date.now();
    for (const offset of offsets) {
      const { otp } = await TOTP.generate(secret, { digits: 6, period: 30, timestamp: ahora + offset });
      if (otp === token) return true;
    }
    return false;
  } catch {
    throw new VisitaError('El código QR de esta sucursal está mal configurado.', 409);
  }
}

// Registro de visita de supervisor: mismo anclaje físico que la marcación (QR TOTP
// de la pantalla + GPS como señal), pero sin selfie/liveness — es un conteo de
// presencia gerencial, no un control de identidad.
//
// Entrada/Salida (2026-07-11): el servidor decide el tipo por paridad de visitas
// del día para ese (empleado, sucursal) — la primera es Entrada, la segunda
// Salida, la tercera Entrada de nuevo (si va y vuelve el mismo día), etc. Se
// reinicia cada día calendario: no hay concepto de "visita abierta" entre días,
// a diferencia de turno_jornada.
async function registrar({ empleadoId, sucursalId, qrToken, gpsLat, gpsLng }) {
  const empleado = await empleadosRepo.obtenerPorId(empleadoId);
  if (!empleado) throw new VisitaError('Empleado no encontrado', 404);
  if (empleado.es_supervisor !== true) {
    throw new VisitaError('Solo el personal marcado como supervisor puede registrar visitas', 403);
  }

  const sucursal = await sucursalesService.obtenerOFallar(sucursalId);
  if (!sucursal.totp_secret) {
    throw new VisitaError('La sucursal no tiene código QR configurado', 409);
  }
  if (!qrToken || !(await totpCoincide(sucursal.totp_secret, qrToken, TOLERANCIA_MS))) {
    throw new VisitaError('Código QR inválido o expirado', 401);
  }

  const dentroGeocerca = geocercaUtil.dentroDeGeocerca(
    gpsLat, gpsLng, sucursal.geo_lat, sucursal.geo_lng, sucursal.geo_radio_m
  );

  const ultimoTipoHoy = await visitasRepo.obtenerUltimoTipoHoy(empleadoId, sucursalId);
  const tipo = ultimoTipoHoy === 'ENTRADA' ? 'SALIDA' : 'ENTRADA';

  const visita = await visitasRepo.crear({ empleadoId, sucursalId, gpsLat, gpsLng, dentroGeocerca, tipo });
  return { id: visita.id, timestamp: visita.timestamp_utc, tipo: visita.tipo, sucursal: sucursal.nombre, dentroGeocerca };
}

function validarRango(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) throw new VisitaError('fechaInicio y fechaFin son requeridos');
  if (!FECHA_RE.test(fechaInicio) || !FECHA_RE.test(fechaFin)) {
    throw new VisitaError('Las fechas deben tener formato YYYY-MM-DD');
  }
}

async function resumen({ fechaInicio, fechaFin }) {
  validarRango(fechaInicio, fechaFin);
  return visitasRepo.resumenPorRango(fechaInicio, fechaFin);
}

// Arma pares Entrada/Salida por (empleado, sucursal, día local): permite ver a
// qué hora llegó y a qué hora se fue. Si un día se queda una Entrada sin su
// Salida (se fue sin escanear de nuevo, o todavía está en la sucursal), el par
// sale con salida_timestamp = null en vez de perderse.
function emparejarVisitas(filas) {
  const grupos = new Map();
  for (const f of filas) {
    const clave = `${f.empleado_id}|${f.sucursal_id}|${f.fecha_local}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(f);
  }

  const pares = [];
  for (const filasGrupo of grupos.values()) {
    filasGrupo.sort((a, b) => new Date(a.timestamp_utc) - new Date(b.timestamp_utc));
    let entradaPendiente = null;
    for (const f of filasGrupo) {
      if (f.tipo === 'ENTRADA') {
        if (entradaPendiente) pares.push(construirPar(entradaPendiente, null));
        entradaPendiente = f;
      } else {
        pares.push(construirPar(entradaPendiente, f));
        entradaPendiente = null;
      }
    }
    if (entradaPendiente) pares.push(construirPar(entradaPendiente, null));
  }

  return pares.sort((a, b) => new Date(b.entrada_timestamp || b.salida_timestamp) - new Date(a.entrada_timestamp || a.salida_timestamp));
}

function construirPar(entrada, salida) {
  const base = entrada || salida;
  const duracionMin = entrada && salida
    ? Math.round((new Date(salida.timestamp_utc) - new Date(entrada.timestamp_utc)) / 60000)
    : null;
  return {
    empleado_id: base.empleado_id,
    nombre: base.nombre,
    apellido: base.apellido,
    sucursal_id: base.sucursal_id,
    sucursal_nombre: base.sucursal_nombre,
    fecha_local: base.fecha_local,
    entrada_timestamp: entrada?.timestamp_utc ?? null,
    entrada_dentro_geocerca: entrada?.dentro_geocerca ?? null,
    salida_timestamp: salida?.timestamp_utc ?? null,
    salida_dentro_geocerca: salida?.dentro_geocerca ?? null,
    duracion_min: duracionMin,
  };
}

async function listar({ fechaInicio, fechaFin }) {
  validarRango(fechaInicio, fechaFin);
  const filas = await visitasRepo.listarPorRango(fechaInicio, fechaFin);
  return emparejarVisitas(filas);
}

module.exports = { registrar, resumen, listar, VisitaError };
