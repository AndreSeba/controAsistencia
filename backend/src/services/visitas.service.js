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

  const visita = await visitasRepo.crear({ empleadoId, sucursalId, gpsLat, gpsLng, dentroGeocerca });
  return { id: visita.id, timestamp: visita.timestamp_utc, sucursal: sucursal.nombre, dentroGeocerca };
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

async function listar({ fechaInicio, fechaFin }) {
  validarRango(fechaInicio, fechaFin);
  return visitasRepo.listarPorRango(fechaInicio, fechaFin);
}

module.exports = { registrar, resumen, listar, VisitaError };
