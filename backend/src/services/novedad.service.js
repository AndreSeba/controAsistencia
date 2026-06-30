const novedadRepo = require('../repositories/novedad.repository');

const TIPOS_VALIDOS = ['baja_medica', 'permiso'];

class NovedadError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function listar({ empleadoId, fechaInicio, fechaFin }) {
  if (!fechaInicio || !fechaFin) throw new NovedadError('fechaInicio y fechaFin son requeridos');
  return novedadRepo.listar({ empleadoId, fechaInicio, fechaFin });
}

async function guardar({ empleadoId, fecha, tipo, nota, usuarioId }) {
  if (!empleadoId || !fecha || !tipo) throw new NovedadError('empleadoId, fecha y tipo son requeridos');
  if (!TIPOS_VALIDOS.includes(tipo)) throw new NovedadError(`tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  return novedadRepo.upsert({ empleadoId, fecha, tipo, nota, usuarioId });
}

async function eliminar({ empleadoId, fecha }) {
  if (!empleadoId || !fecha) throw new NovedadError('empleadoId y fecha son requeridos');
  await novedadRepo.eliminar({ empleadoId, fecha });
}

module.exports = { listar, guardar, eliminar };
