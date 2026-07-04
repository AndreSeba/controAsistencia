const crypto = require('crypto');

const sucursalesRepo = require('../repositories/sucursales.repository');
const sucursalesService = require('./sucursales.service');

class QrTokenError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function tokenCoincide(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// La pantalla física de la sucursal no tiene login JWT: su credencial es el
// pantalla_token que viaja en el enlace copiado desde el panel (?k=...).
// Sin él, este endpoint entregaría el secreto TOTP a cualquiera que conociera
// la URL — y con el secreto se pueden fabricar códigos QR para cualquier momento.
async function obtenerVigente(sucursalId, pantallaToken) {
  let sucursal = await sucursalesService.obtenerOFallar(sucursalId);

  if (!tokenCoincide(pantallaToken, sucursal.pantalla_token)) {
    throw new QrTokenError('Enlace de pantalla inválido. Copiá el enlace desde el panel de RRHH.');
  }

  if (!sucursal.totp_secret) {
    const secret = sucursalesRepo.generarTotpSecret();
    await sucursalesRepo.guardarTotpSecret(sucursalId, secret);
    sucursal = { ...sucursal, totp_secret: secret };
  }

  return {
    totpSecret: sucursal.totp_secret,
    serverTime: Date.now(),
  };
}

module.exports = { obtenerVigente, QrTokenError };
