const sucursalesRepo = require('../repositories/sucursales.repository');
const sucursalesService = require('./sucursales.service');

async function obtenerVigente(sucursalId) {
  let sucursal = await sucursalesService.obtenerOFallar(sucursalId);

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

module.exports = { obtenerVigente };
