const crypto = require('crypto');

const dispositivosCorpRepo = require('../repositories/dispositivosCorporativos.repository');
const sucursalesService = require('./sucursales.service');
const empleadosService = require('./empleados.service');
const auditoriaRepo = require('../repositories/auditoria.repository');

class DispositivoCorporativoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listar() {
  return dispositivosCorpRepo.listar();
}

async function obtenerOFallar(id) {
  const dispositivo = await dispositivosCorpRepo.obtenerPorId(id);
  if (!dispositivo) throw new DispositivoCorporativoError('Dispositivo corporativo no encontrado', 404);
  return dispositivo;
}

// A diferencia del dispositivo personal (P4, un solo device por empleado), acá el
// token identifica AL TELÉFONO, no a una persona — se comparte entre los empleados que
// RRHH habilite. Se devuelve una sola vez, igual que el device_token personal.
async function crear({ sucursalId, nombre }, usuarioId, ip) {
  await sucursalesService.obtenerOFallar(sucursalId);
  if (!nombre?.trim()) throw new DispositivoCorporativoError('nombre es requerido');

  const deviceToken = crypto.randomBytes(32).toString('hex');
  const creado = await dispositivosCorpRepo.crear({ sucursalId, nombre: nombre.trim(), deviceToken, aprobadoPorRrhh: usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'crear_dispositivo_corporativo',
    tabla: 'dispositivo_corporativo',
    registroId: creado.id,
    ip,
    detalle: { sucursalId, nombre },
  });

  return { id: creado.id, deviceToken, fechaRegistro: creado.fecha_registro };
}

// Bloqueo duro de sucursal (ver marcaciones.service.js): el teléfono no se mueve solo,
// pero el cliente pidió que sea editable por si el negocio reasigna el celular físico.
// Reenvío del enlace de activación (mismo patrón que dispositivos.service.js): no
// regenera el token, solo lo devuelve por si RRHH necesita reconfigurar el celular
// físico (reset, cambio de equipo) sin romper las habilitaciones ya existentes.
async function obtenerEnlace(id) {
  const dispositivo = await obtenerOFallar(id);
  return { deviceToken: dispositivo.device_token };
}

async function reasignarSucursal(id, { sucursalId }, usuarioId, ip) {
  const anterior = await obtenerOFallar(id);
  await sucursalesService.obtenerOFallar(sucursalId);

  await dispositivosCorpRepo.actualizarSucursal(id, { sucursalId, usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'reasignar_sucursal_dispositivo_corporativo',
    tabla: 'dispositivo_corporativo',
    registroId: id,
    ip,
    detalle: { sucursalAnteriorId: anterior.sucursal_id, sucursalNuevaId: sucursalId },
  });

  return obtenerOFallar(id);
}

async function revocar(id, usuarioId, ip) {
  await obtenerOFallar(id);
  await dispositivosCorpRepo.revocar(id);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'revocar_dispositivo_corporativo',
    tabla: 'dispositivo_corporativo',
    registroId: id,
    ip,
  });
}

async function listarEmpleadosHabilitados(dispositivoCorporativoId) {
  return dispositivosCorpRepo.listarEmpleadosHabilitados(dispositivoCorporativoId);
}

async function habilitarEmpleado(dispositivoCorporativoId, empleadoId, usuarioId, ip) {
  await obtenerOFallar(dispositivoCorporativoId);
  await empleadosService.obtenerOFallar(empleadoId);

  const yaHabilitado = await dispositivosCorpRepo.buscarHabilitacion(dispositivoCorporativoId, empleadoId);
  if (yaHabilitado) {
    throw new DispositivoCorporativoError('Ese empleado ya está habilitado en este dispositivo', 409);
  }

  const creado = await dispositivosCorpRepo.habilitarEmpleado({ dispositivoCorporativoId, empleadoId, usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'habilitar_empleado_dispositivo_corporativo',
    tabla: 'dispositivo_corporativo_empleado',
    registroId: creado.id,
    ip,
    detalle: { dispositivoCorporativoId, empleadoId },
  });

  return creado;
}

async function deshabilitarEmpleado(habilitacionId, usuarioId, ip) {
  await dispositivosCorpRepo.deshabilitarEmpleado(habilitacionId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'deshabilitar_empleado_dispositivo_corporativo',
    tabla: 'dispositivo_corporativo_empleado',
    registroId: habilitacionId,
    ip,
  });
}

module.exports = {
  listar,
  obtenerOFallar,
  crear,
  obtenerEnlace,
  reasignarSucursal,
  revocar,
  listarEmpleadosHabilitados,
  habilitarEmpleado,
  deshabilitarEmpleado,
  DispositivoCorporativoError,
};
