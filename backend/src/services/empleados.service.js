const empleadosRepo = require('../repositories/empleados.repository');

class EmpleadoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function crear({ nombre, apellido, documentoNro, hrmsRef }) {
  if (!nombre?.trim()) throw new EmpleadoError('nombre es requerido');
  if (!apellido?.trim()) throw new EmpleadoError('apellido es requerido');
  if (!documentoNro?.trim()) throw new EmpleadoError('documentoNro (CI) es requerido');

  const existente = await empleadosRepo.buscarPorDocumento(documentoNro.trim());
  if (existente) {
    throw new EmpleadoError(`Ya existe un empleado con ese documento: ${existente.nombre} ${existente.apellido}`, 409);
  }

  const id = await empleadosRepo.crear({ nombre, apellido, documentoNro: documentoNro.trim(), hrmsRef });
  return obtenerOFallar(id);
}

async function actualizar(id, { nombre, apellido, documentoNro, estado, hrmsRef }) {
  if (!nombre?.trim()) throw new EmpleadoError('nombre es requerido');
  if (!apellido?.trim()) throw new EmpleadoError('apellido es requerido');
  if (!documentoNro?.trim()) throw new EmpleadoError('documentoNro (CI) es requerido');
  
  if (estado && estado !== 'activo' && estado !== 'inactivo') {
    throw new EmpleadoError('estado inválido (debe ser activo o inactivo)');
  }

  const existente = await empleadosRepo.buscarPorDocumento(documentoNro.trim());
  if (existente && existente.id !== id) {
    throw new EmpleadoError(`Ya existe otro empleado con ese documento: ${existente.nombre} ${existente.apellido}`, 409);
  }

  await empleadosRepo.actualizar(id, { nombre, apellido, documentoNro: documentoNro.trim(), estado, hrmsRef });
  return obtenerOFallar(id);
}

async function listar(incluirInactivos) {
  return empleadosRepo.listar(incluirInactivos);
}

async function obtenerOFallar(id) {
  const empleado = await empleadosRepo.obtenerPorId(id);
  if (!empleado) throw new EmpleadoError('Empleado no encontrado', 404);
  return empleado;
}

module.exports = { crear, actualizar, listar, obtenerOFallar, EmpleadoError };
