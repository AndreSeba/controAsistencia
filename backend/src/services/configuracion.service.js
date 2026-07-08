const configuracionRepo = require('../repositories/configuracion.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');

const CLAVE_MARGEN_ANTICIPACION = 'margen_anticipacion_min';
const CLAVE_PAGO_DIA = 'pago_dia_bs';
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

module.exports = {
  obtenerMargenAnticipacion,
  actualizarMargenAnticipacion,
  obtenerPagoDiaBs,
  actualizarPagoDiaBs,
  ConfiguracionError,
};
