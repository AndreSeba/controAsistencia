const crypto = require('crypto');

const qrTokenRepo = require('../repositories/qrToken.repository');
const sucursalesService = require('./sucursales.service');

const REUSO_MARGEN_SEGUNDOS = 5;

async function obtenerVigente(sucursalId) {
  const sucursal = await sucursalesService.obtenerOFallar(sucursalId);
  
  if (!sucursal.totp_secret) {
    // Si no tiene, se podría generar una aquí o debería venir de la BD
    throw new Error('La sucursal no tiene configurada la generación de QR offline (TOTP)');
  }

  // Devolvemos la llave maestra para que el kiosko genere los tokens offline
  return { 
    totpSecret: sucursal.totp_secret, 
    serverTime: Date.now() 
  };
}

module.exports = { obtenerVigente };
