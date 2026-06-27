const crypto = require('crypto');

const dispositivosRepo = require('../repositories/dispositivos.repository');
const empleadosService = require('./empleados.service');
const auditoriaRepo = require('../repositories/auditoria.repository');

class DispositivoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// RRHH enrola el primer (y único) dispositivo activo del empleado. El device_token se
// devuelve una sola vez: el cliente lo persiste en IndexedDB. No autoservicio (P4).
async function enrolar(empleadoId, usuarioId, ip) {
  await empleadosService.obtenerOFallar(empleadoId);

  const activo = await dispositivosRepo.buscarActivoPorEmpleado(empleadoId);
  if (activo) {
    throw new DispositivoError(
      'El empleado ya tiene un dispositivo activo. Revocarlo antes de enrolar uno nuevo.',
      409
    );
  }

  const deviceToken = crypto.randomBytes(32).toString('hex');
  const creado = await dispositivosRepo.crear({ empleadoId, deviceToken, aprobadoPorRrhh: usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'enrolar_dispositivo',
    tabla: 'dispositivo_empleado',
    registroId: creado.id,
    ip,
    detalle: { empleadoId },
  });

  return { id: creado.id, deviceToken, fechaRegistro: creado.fecha_registro };
}

// Reenvío del enlace de activación: no regenera el token (eso rompería el dispositivo
// ya configurado), solo devuelve el que ya está activo para que RRHH lo comparta de
// nuevo si el empleado lo perdió.
async function obtenerEnlace(empleadoId) {
  const activo = await dispositivosRepo.buscarActivoPorEmpleado(empleadoId);
  if (!activo) throw new DispositivoError('Empleado sin dispositivo activo', 404);
  return { deviceToken: activo.device_token };
}

async function revocar(dispositivoId, empleadoId, usuarioId, ip) {
  const activo = await dispositivosRepo.buscarActivoPorEmpleado(empleadoId);
  if (!activo || activo.id !== dispositivoId) {
    throw new DispositivoError('Dispositivo activo no encontrado para ese empleado', 404);
  }
  await dispositivosRepo.revocar(dispositivoId);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'revocar_dispositivo',
    tabla: 'dispositivo_empleado',
    registroId: dispositivoId,
    ip,
    detalle: { empleadoId },
  });
}

module.exports = { enrolar, revocar, obtenerEnlace, DispositivoError };
