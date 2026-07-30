const crypto = require('crypto');

const dispositivosRepo = require('../repositories/dispositivos.repository');
const dispositivosCorpRepo = require('../repositories/dispositivosCorporativos.repository');
const empleadosRepo = require('../repositories/empleados.repository');
const empleadosService = require('./empleados.service');
const biometriaRepo = require('../repositories/biometria.repository');
const cifradoService = require('./cifrado.service');
const faceMatchService = require('./faceMatch.service');
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

// Reenvío del enlace de activación. Si ya hay un código vigente sin usar, devuelve
// ESE MISMO — no genera uno nuevo.
//
// Antes cada click generaba un código nuevo y mataba el anterior, y eso rompía el
// flujo real de RRHH (2026-07-25, enrolamiento en vivo): "Enrolar dispositivo" ya
// copia un link, pero la confirmación de copiado pasa desapercibida, así que RRHH
// tocaba además "Copiar enlace" — invalidando en silencio el link que acababa de
// mandar por WhatsApp. El empleado abría ese link y le salía "código ya usado".
// Devolver el mismo código hace la acción idempotente: se puede tocar N veces y el
// link mandado sigue sirviendo. No afecta la seguridad — sigue siendo de un solo
// uso y sigue sin exponer el device_token real.
async function obtenerEnlace(empleadoId) {
  const activo = await dispositivosRepo.buscarActivoPorEmpleado(empleadoId);
  if (!activo) throw new DispositivoError('Empleado sin dispositivo activo', 404);
  if (activo.activacion_token) return { activacionToken: activo.activacion_token };

  const activacionToken = crypto.randomBytes(24).toString('hex');
  await dispositivosRepo.generarActivacion(activo.id, activacionToken);
  return { activacionToken };
}

// Canjea el código de activación por el device_token real — lo llama la PWA (sin
// JWT, es su único credencial en ese momento), nunca el panel.
//
// REUTILIZABLE (decisión del usuario 2026-07-26, reabre la decisión del 2026-07-16):
// el mismo link sirve todas las veces que haga falta, hasta que RRHH revoque el
// dispositivo. El de-un-solo-uso rompía el flujo real: WhatsApp abre los links en su
// navegador interno, así que el empleado activaba ahí, después abría Chrome (sin el
// token guardado), volvía al chat, tocaba el mismo link y ya no servía. Pasó con
// varias personas de Administración el 2026-07-25.
// Lo que SÍ se conserva del cambio anterior: el device_token real nunca viaja en la
// URL — sigue siendo un código intermedio, y revocar el dispositivo lo mata.
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
    await dispositivosRepo.registrarPrimeraActivacion(dispositivo.id);
    return { deviceToken: dispositivo.device_token };
  }

  const corporativo = await dispositivosCorpRepo.buscarPorToken(activacionToken);
  if (corporativo) {
    return { deviceToken: activacionToken };
  }

  throw new DispositivoError(
    'Este código de activación no es válido o el dispositivo fue revocado. Pedí a RRHH que te comparta el enlace de nuevo.',
    404
  );
}

// Mismo mensaje SIEMPRE, para los 4 motivos de rechazo (CI inexistente, ya tiene
// dispositivo, sin biometría, cara no coincide) — nunca distinguir cuál fue: si no, el
// endpoint se vuelve una forma de averiguar qué CIs son válidos o de tantear el
// face-match. El motivo real solo queda en `auditoria`, para RRHH, nunca en la respuesta.
const RECHAZO_GENERICO = 'No pudimos verificar tu identidad con esos datos. Pedí a RRHH que te ayude a activar el dispositivo.';

async function registrarIntentoAutoActivacion({ empleadoId, documentoNro, ip, exito, motivo, score, dispositivoId }) {
  await auditoriaRepo.registrar({
    usuarioId: null, // no hay usuario de RRHH autenticado: el propio empleado, sin sesión
    accion: 'autoactivar_dispositivo',
    tabla: 'dispositivo_empleado',
    registroId: dispositivoId ?? empleadoId ?? 0,
    ip,
    detalle: {
      documentoNro,
      empleadoId: empleadoId ?? null,
      exito,
      motivo,
      score: score != null ? Number(score.toFixed(4)) : null,
    },
  });
}

// Auto-activación con link genérico: CI + selfie comparada contra la biometría YA
// enrolada por RRHH, vía el mismo motor de face-match real que usa cada marcación —
// no es una barrera nueva y más floja, es la misma en la que el sistema ya confía a
// diario, aplicada una vez para vincular el teléfono en vez de en cada marca (ver
// CLAUDE.md, "Auto-activación con link genérico + CI + selfie"). Reabre P4 parcialmente:
// solo cubre el caso feliz (empleado activo, con biometría, cara coincide) — para
// cualquier otro caso (sin biometría, ya tiene dispositivo, disputa) sigue haciendo
// falta RRHH vía el enlace de invitación de siempre, que esto no reemplaza.
async function autoActivar({ documentoNro, selfieBuffer, ip }) {
  if (!documentoNro?.trim()) throw new DispositivoError('El número de CI es requerido');
  if (!selfieBuffer?.length) throw new DispositivoError('La selfie es requerida');
  const doc = documentoNro.trim();

  const empleado = await empleadosRepo.buscarActivoPorDocumento(doc);
  if (!empleado) {
    await registrarIntentoAutoActivacion({ empleadoId: null, documentoNro: doc, ip, exito: false, motivo: 'ci_no_encontrado' });
    throw new DispositivoError(RECHAZO_GENERICO, 401);
  }

  // Bloquea "robar" el lugar de otro: si ya hay un dispositivo activo, la re-activación
  // por pérdida sigue siendo manual vía RRHH (revocar + reenrolar), como hoy.
  const yaActivo = await dispositivosRepo.buscarActivoPorEmpleado(empleado.id);
  if (yaActivo) {
    await registrarIntentoAutoActivacion({ empleadoId: empleado.id, documentoNro: doc, ip, exito: false, motivo: 'ya_tiene_dispositivo' });
    throw new DispositivoError(RECHAZO_GENERICO, 401);
  }

  const biometria = await biometriaRepo.buscarActivoPorEmpleado(empleado.id);
  if (!biometria) {
    await registrarIntentoAutoActivacion({ empleadoId: empleado.id, documentoNro: doc, ip, exito: false, motivo: 'sin_biometria' });
    throw new DispositivoError(RECHAZO_GENERICO, 401);
  }

  const template = cifradoService.descifrar(biometria.face_template_cifrado);
  const comparacion = await faceMatchService.comparar(selfieBuffer, template);
  if (!comparacion.match) {
    await registrarIntentoAutoActivacion({ empleadoId: empleado.id, documentoNro: doc, ip, exito: false, motivo: 'no_coincide', score: comparacion.score });
    throw new DispositivoError(RECHAZO_GENERICO, 401);
  }

  // La selfie de verificación NUNCA se sube a Storage (ni en éxito ni en fallo, decisión
  // explícita del usuario 2026-07-29) — comparar() ya trabajó en memoria; acá no hay
  // ninguna llamada a almacenamientoService, a propósito. Solo persiste el resultado.
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const creado = await dispositivosRepo.crear({
    empleadoId: empleado.id, deviceToken, activacionToken: null, aprobadoPorRrhh: null,
  });

  await registrarIntentoAutoActivacion({
    empleadoId: empleado.id, documentoNro: doc, ip, exito: true, motivo: 'autoactivado',
    score: comparacion.score, dispositivoId: creado.id,
  });

  return { deviceToken };
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

module.exports = { enrolar, revocar, obtenerEnlace, activarPorToken, autoActivar, DispositivoError };
