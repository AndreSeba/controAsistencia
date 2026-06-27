const sucursalesRepo = require('../repositories/sucursales.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');

const RADIO_MIN_M = 20;
const RADIO_MAX_M = 500;

class SucursalError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function validarGeocerca({ geoLat, geoLng, geoRadioM }) {
  if (geoLat == null || geoLng == null || geoRadioM == null) {
    throw new SucursalError('geoLat, geoLng y geoRadioM son requeridos');
  }
  if (geoLat < -90 || geoLat > 90 || geoLng < -180 || geoLng > 180) {
    throw new SucursalError('Coordenadas fuera de rango');
  }
  if (geoRadioM < RADIO_MIN_M || geoRadioM > RADIO_MAX_M) {
    throw new SucursalError(`geoRadioM debe estar entre ${RADIO_MIN_M} y ${RADIO_MAX_M} metros`);
  }
}

async function listar(incluirInactivas) {
  return sucursalesRepo.listar(incluirInactivas);
}

async function obtenerOFallar(id) {
  const sucursal = await sucursalesRepo.obtenerPorId(id);
  if (!sucursal) throw new SucursalError('Sucursal no encontrada', 404);
  return sucursal;
}

async function crear(datos, usuarioId, ip) {
  if (!datos.nombre?.trim()) throw new SucursalError('nombre es requerido');
  validarGeocerca(datos);

  const id = await sucursalesRepo.crear({ ...datos, usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'crear_sucursal',
    tabla: 'sucursal',
    registroId: id,
    ip,
    detalle: { nuevo: datos },
  });

  return obtenerOFallar(id);
}

async function actualizarDatos(id, { nombre, activo }) {
  await obtenerOFallar(id);
  if (!nombre?.trim()) throw new SucursalError('nombre es requerido');
  await sucursalesRepo.actualizarDatos(id, { nombre, activo: !!activo });
  return obtenerOFallar(id);
}

async function actualizarGeocerca(id, datos, usuarioId, ip) {
  const anterior = await obtenerOFallar(id);
  validarGeocerca(datos);

  await sucursalesRepo.actualizarGeocerca(id, { ...datos, usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'actualizar_geocerca',
    tabla: 'sucursal',
    registroId: id,
    ip,
    detalle: {
      anterior: {
        geoLat: anterior.geo_lat,
        geoLng: anterior.geo_lng,
        geoRadioM: anterior.geo_radio_m,
        wifiBssid: anterior.wifi_bssid,
      },
      nuevo: datos,
    },
  });

  return obtenerOFallar(id);
}

module.exports = { listar, obtenerOFallar, crear, actualizarDatos, actualizarGeocerca, SucursalError };
