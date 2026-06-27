const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';

function clave() {
  const hex = process.env.BIOMETRIC_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('BIOMETRIC_ENC_KEY debe ser hex de 32 bytes (64 caracteres)');
  }
  return Buffer.from(hex, 'hex');
}

// Cifra un buffer (template biométrico) en reposo. Formato: iv(12) | authTag(16) | ciphertext.
function cifrar(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, clave(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function descifrar(buffer) {
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITMO, clave(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { cifrar, descifrar };
