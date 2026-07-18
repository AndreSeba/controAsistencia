const crypto = require('crypto');

const dispositivosRepo = require('../repositories/dispositivos.repository');
const dispositivosCorpRepo = require('../repositories/dispositivosCorporativos.repository');
const empleadosService = require('./empleados.service');
const auditoriaRepo = require('../repositories/auditoria.repository');

class DispositivoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// RRHH enrola el primer (y único) dispositivo activo del empleado. El device_token
// real nunca vuelve a salir del backend después de esto — el link que se comparte
// lleva un código de activación de un solo uso (activacionToken), no el device_token.
// No autoservicio (P4).
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
  const activacionToken = crypto.randomBytes(24).toString('hex');
  const creado = await dispositivosRepo.crear({ empleadoId, deviceToken, activacionToken, aprobadoPorRrhh: usuarioId });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'enrolar_dispositivo',
    tabla: 'dispositivo_empleado',
    registroId: creado.id,
    ip,
    detalle: { empleadoId },
  });

  return { id: creado.id, activacionToken, fechaRegistro: creado.fecha_registro };
}

// Reenvío del enlace de activación: genera un código de activación NUEVO (de un
// solo uso), invalidando cualquier link anterior sin usar. No regenera el
// device_token real (eso rompería el dispositivo ya configurado si ya fue activado).
async function obtenerEnlace(empleadoId) {
  const activo = await dispositivosRepo.buscarActivoPorEmpleado(empleadoId);
  if (!activo) throw new DispositivoError('Empleado sin dispositivo activo', 404);
  const activacionToken = crypto.randomBytes(24).toString('hex');
  await dispositivosRepo.generarActivacion(activo.id, activacionToken);
  return { activacionToken };
}

// Canjea el código de activación por el device_token real — lo llama la PWA (sin
// JWT, es su único credencial en ese momento), nunca el panel. Un mismo código solo
// funciona una vez: el segundo intento (link reenviado a otra persona, o reabierto
// por error) cae acá con 404.
//
// El enlace de un dispositivo CORPORATIVO (P16) no lleva un código de un solo uso —
// lleva directo el device_token permanente del celular físico (decisión consciente,
// ver CLAUDE.md: ese link solo configura el teléfono compartido, no protege identidad
// individual, así que no hace falta el mismo mecanismo de un solo uso). Por eso, si el
// valor no matchea ningún código de activación personal, se prueba como device_token
// corporativo antes de fallar — de lo contrario el enlace de "Copiar enlace" en
// Dispositivos corporativos quedaría roto (siempre 404).
async function activarPorToken(activacionToken) {
  const dispositivo = await dispositivosRepo.buscarPorActivacionToken(activacionToken);
  if (dispositivo) {
    await dispositivosRepo.marcarActivacionUsada(dispositivo.id);
    return { deviceToken: dispositivo.device_token };
  }

  const corporativo = await dispositivosCorpRepo.buscarPorToken(activacionToken);
  if (corporativo) {
    return { deviceToken: activacionToken };
  }

  throw new DispositivoError(
    'Este código de activación ya fue usado o no es válido. Pedí a RRHH que te comparta uno nuevo.',
    404
  );
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

module.exports = { enrolar, revocar, obtenerEnlace, activarPorToken, DispositivoError };
