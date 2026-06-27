const configuracionRepo = require('../repositories/configuracion.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');

const CLAVE_MARGEN_ANTICIPACION = 'margen_anticipacion_min';
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

module.exports = { obtenerMargenAnticipacion, actualizarMargenAnticipacion, ConfiguracionError };
