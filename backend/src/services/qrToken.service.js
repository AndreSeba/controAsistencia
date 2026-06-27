const crypto = require('crypto');

const qrTokenRepo = require('../repositories/qrToken.repository');
const sucursalesService = require('./sucursales.service');

const REUSO_MARGEN_SEGUNDOS = 5;

function ttlMs() {
  return Number(process.env.QR_TOKEN_TTL_SECONDS || 45) * 1000;
}

// Devuelve el token vigente de la sucursal, rotando uno nuevo si no queda margen.
// La rotación es perezosa (a demanda), no un cron: la pantalla de la sucursal hace
// polling y siempre recibe un token con TTL corto.
async function obtenerVigente(sucursalId) {
  await sucursalesService.obtenerOFallar(sucursalId);

  const vigente = await qrTokenRepo.buscarVigentePorSucursal(sucursalId);
  const margenMs = REUSO_MARGEN_SEGUNDOS * 1000;
  if (vigente && new Date(vigente.valido_hasta) - Date.now() > margenMs) {
    return { token: vigente.token, validoHasta: vigente.valido_hasta };
  }

  const token = crypto.randomBytes(24).toString('hex');
  const validoDesde = new Date();
  const validoHasta = new Date(Date.now() + ttlMs());
  await qrTokenRepo.crear({ sucursalId, token, validoDesde, validoHasta });

  return { token, validoHasta };
}

module.exports = { obtenerVigente };
