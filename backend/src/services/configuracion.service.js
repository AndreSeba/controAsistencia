const configuracionRepo = require('../repositories/configuracion.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');
const almacenamientoService = require('./almacenamiento.service');

const CLAVE_MARGEN_ANTICIPACION = 'margen_anticipacion_min';
const CLAVE_PAGO_DIA = 'pago_dia_bs';
const CLAVE_LOGO = 'logo_url';
const MARGEN_MAX_MIN = 240; // 4hs: tope sano, evita que un valor absurdo deje todo en revisión

class ConfiguracionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function obtenerMargenAnticipacion() {
  const fila = await configuracionRepo.obtener(CLAVE_MARGEN_ANTICIPACION);
  return fila ? Number(fila.valor) : 0;
}

async function actualizarMargenAnticipacion(minutos, usuarioId, ip) {
  if (!Number.isInteger(minutos) || minutos < 0 || minutos > MARGEN_MAX_MIN) {
    throw new ConfiguracionError(`margenAnticipacionMin debe ser un entero entre 0 y ${MARGEN_MAX_MIN}`);
  }

  const anterior = await obtenerMargenAnticipacion();
  await configuracionRepo.actualizar(CLAVE_MARGEN_ANTICIPACION, String(minutos), usuarioId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'actualizar_margen_anticipacion',
    tabla: 'configuracion',
    registroId: CLAVE_MARGEN_ANTICIPACION,
    ip,
    detalle: { anterior, nuevo: minutos },
  });

  return minutos;
}

async function obtenerPagoDiaBs() {
  const fila = await configuracionRepo.obtener(CLAVE_PAGO_DIA);
  return fila ? Number(fila.valor) : 10;
}

async function actualizarPagoDiaBs(monto, usuarioId, ip) {
  if (typeof monto !== 'number' || Number.isNaN(monto) || monto < 0) {
    throw new ConfiguracionError('pagoDiaBs debe ser un número ≥ 0');
  }

  const anterior = await obtenerPagoDiaBs();
  await configuracionRepo.actualizar(CLAVE_PAGO_DIA, String(monto), usuarioId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'actualizar_pago_dia',
    tabla: 'configuracion',
    registroId: CLAVE_PAGO_DIA,
    ip,
    detalle: { anterior, nuevo: monto },
  });

  return monto;
}

// Logo de la empresa: se guarda solo la URL pública en `configuracion` (clave/valor),
// el archivo va al mismo bucket que las selfies/fotos de referencia. Sin fila = sin
// logo cargado, y la UI cae al texto de siempre.
async function obtenerLogoUrl() {
  const fila = await configuracionRepo.obtener(CLAVE_LOGO);
  return fila?.valor || null;
}

async function actualizarLogo(fotoBuffer, fotoMimetype, usuarioId, ip) {
  if (!fotoBuffer?.length) throw new ConfiguracionError('archivo de logo requerido');

  const anterior = await obtenerLogoUrl();
  const logoUrl = await almacenamientoService.guardar('logo', fotoBuffer, fotoMimetype);
  await configuracionRepo.actualizar(CLAVE_LOGO, logoUrl, usuarioId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'actualizar_logo',
    tabla: 'configuracion',
    registroId: CLAVE_LOGO,
    ip,
    detalle: { anterior, nuevo: logoUrl },
  });

  return logoUrl;
}

// Quitar el logo no borra el archivo del bucket (las URLs son opacas y no hay índice
// navegable) — solo deja de referenciarlo, y la UI vuelve al texto.
async function quitarLogo(usuarioId, ip) {
  const anterior = await obtenerLogoUrl();
  await configuracionRepo.actualizar(CLAVE_LOGO, '', usuarioId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'quitar_logo',
    tabla: 'configuracion',
    registroId: CLAVE_LOGO,
    ip,
    detalle: { anterior },
  });
}

module.exports = {
  obtenerMargenAnticipacion,
  actualizarMargenAnticipacion,
  obtenerPagoDiaBs,
  actualizarPagoDiaBs,
  obtenerLogoUrl,
  actualizarLogo,
  quitarLogo,
  ConfiguracionError,
};
