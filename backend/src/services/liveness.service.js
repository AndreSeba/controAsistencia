const crypto = require('crypto');

const livenessRepo = require('../repositories/liveness.repository');

const TIPOS_RETO = ['PARPADEO', 'GIRO_IZQUIERDA', 'GIRO_DERECHA', 'SONREIR'];

class LivenessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function ttlMs() {
  return Number(process.env.LIVENESS_RETO_TTL_SECONDS || 30) * 1000;
}

async function emitirReto(empleadoId) {
  const tipoReto = TIPOS_RETO[crypto.randomInt(TIPOS_RETO.length)];
  const nonce = crypto.randomBytes(24).toString('hex');
  const expira = new Date(Date.now() + ttlMs());
  await livenessRepo.crearReto({ empleadoId, nonce, tipoReto, expira });
  return { nonce, tipoReto, expira };
}

// Valida y consume el reto (de un solo uso). No hace el análisis real de frames todavía
// (ver faceMatch.service.js — motor real pendiente); por ahora solo verifica la
// vigencia/propiedad del nonce, que sí es una garantía real de anti-replay.
async function validarYConsumir(nonce, empleadoId, transaction) {
  const reto = await livenessRepo.buscarPorNonce(nonce, transaction);
  if (!reto) throw new LivenessError('Reto de liveness no encontrado');
  if (reto.empleado_id !== empleadoId) throw new LivenessError('Reto de liveness no corresponde al empleado');
  if (reto.usado) throw new LivenessError('Reto de liveness ya fue usado');
  if (new Date(reto.expira) < new Date()) throw new LivenessError('Reto de liveness expirado');

  await livenessRepo.marcarUsado(reto.id, transaction);

  // STUB: motor real de detección de movimiento/reto pendiente. Por ahora, vigencia +
  // propiedad + un solo uso ya están garantizados arriba; el resultado del "análisis"
  // se asume exitoso.
  return { livenessOk: true, livenessRetoId: reto.id };
}

module.exports = { emitirReto, validarYConsumir, LivenessError };
