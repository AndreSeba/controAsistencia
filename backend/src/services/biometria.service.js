const biometriaRepo = require('../repositories/biometria.repository');
const empleadosService = require('./empleados.service');
const faceMatchService = require('./faceMatch.service');
const cifradoService = require('./cifrado.service');
const almacenamientoService = require('./almacenamiento.service');
const auditoriaRepo = require('../repositories/auditoria.repository');

class BiometriaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Enrolamiento supervisado por RRHH: re-enrolar revoca el anterior (no hay
// autoservicio ni borrado directo por el empleado).
async function enrolar(empleadoId, fotoBuffer, fotoMimetype, usuarioId, ip) {
  await empleadosService.obtenerOFallar(empleadoId);
  if (!fotoBuffer?.length) throw new BiometriaError('foto de referencia es requerida');

  const template = await faceMatchService.generarTemplate(fotoBuffer);
  const templateCifrado = cifradoService.cifrar(template);
  const fotoUrl = await almacenamientoService.guardar('biometria', fotoBuffer, fotoMimetype);

  await biometriaRepo.revocarActivos(empleadoId);
  const creado = await biometriaRepo.crear({
    empleadoId,
    templateCifrado,
    fotoUrl,
    enroladoPor: usuarioId,
  });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'enrolar_biometria',
    tabla: 'enrolamiento_biometrico',
    registroId: creado.id,
    ip,
    detalle: { empleadoId },
  });

  return { id: creado.id, fotoUrl, fecha: creado.fecha };
}

async function obtenerActivoOFallar(empleadoId) {
  const enrolamiento = await biometriaRepo.buscarActivoPorEmpleado(empleadoId);
  if (!enrolamiento) throw new BiometriaError('Empleado sin enrolamiento biométrico activo', 404);
  return enrolamiento;
}

module.exports = { enrolar, obtenerActivoOFallar, BiometriaError };
