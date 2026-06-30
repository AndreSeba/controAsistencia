const descuentosRepo = require('../repositories/descuentos.repository');
const reglaDescuentoRepo = require('../repositories/reglaDescuento.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');

async function listarReglas() {
  return reglaDescuentoRepo.listar();
}

async function actualizarRegla(id, montoBs, usuarioId, ip) {
  if (montoBs === undefined || montoBs === null || isNaN(Number(montoBs)) || Number(montoBs) < 0) {
    throw new DescuentoError('monto_bs debe ser un número ≥ 0');
  }
  const regla = await reglaDescuentoRepo.actualizar(id, Number(montoBs));
  if (!regla) throw new DescuentoError('Regla no encontrada', 404);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'regla_descuento_actualizada',
    tabla: 'regla_descuento',
    registroId: id,
    ip,
    detalle: { monto_bs: Number(montoBs) },
  });
  return regla;
}

class DescuentoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const TRANSICIONES = {
  calculado: 'aprobado',
  aprobado: 'aplicado',
};

// Se llama dentro de la transacción de marcaciones.service.js para una ENTRADA con
// atraso > 0. No crea fila si la banda vigente da 0 Bs (tolerancia, P7).
async function calcularParaEntrada({ marcacionId, empleadoId, minutosAtraso, periodo }, transaction) {
  if (!minutosAtraso || minutosAtraso <= 0) return;

  const regla = await reglaDescuentoRepo.buscarPorMinutosAtraso(minutosAtraso, transaction);
  if (!regla || Number(regla.monto_bs) <= 0) return;

  await descuentosRepo.crear({
    marcacionId,
    empleadoId,
    montoBs: regla.monto_bs,
    reglaId: regla.id,
    periodo,
  }, transaction);
}

async function listar(filtros) {
  return descuentosRepo.listar(filtros);
}

async function reportePorPeriodo(periodo) {
  if (!periodo) throw new DescuentoError('periodo (YYYY-MM) es requerido');
  return descuentosRepo.reportePorPeriodo(periodo);
}

async function avanzarEstado(id, usuarioId, ip) {
  const descuento = await descuentosRepo.obtenerPorId(id);
  if (!descuento) throw new DescuentoError('Descuento no encontrado', 404);

  const siguienteEstado = TRANSICIONES[descuento.estado];
  if (!siguienteEstado) {
    throw new DescuentoError(`Un descuento en estado "${descuento.estado}" no tiene siguiente paso`, 409);
  }

  await descuentosRepo.actualizarEstado(id, siguienteEstado, usuarioId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: `descuento_${descuento.estado}_a_${siguienteEstado}`,
    tabla: 'descuento',
    registroId: id,
    ip,
    detalle: { anterior: descuento.estado, nuevo: siguienteEstado },
  });

  return descuentosRepo.obtenerPorId(id);
}

module.exports = { calcularParaEntrada, listar, reportePorPeriodo, avanzarEstado, listarReglas, actualizarRegla, DescuentoError };
