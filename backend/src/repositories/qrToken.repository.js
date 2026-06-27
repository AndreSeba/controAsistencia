const { getPool } = require('../config/db');

async function buscarVigentePorSucursal(sucursalId, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, sucursal_id, token, valido_desde, valido_hasta
     FROM qr_token
     WHERE sucursal_id = $1 AND valido_hasta > NOW()
     ORDER BY valido_hasta DESC
     LIMIT 1`,
    [sucursalId]
  );
  return result.rows[0] || null;
}

async function crear({ sucursalId, token, validoDesde, validoHasta }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO qr_token (sucursal_id, token, valido_desde, valido_hasta)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [sucursalId, token, validoDesde, validoHasta]
  );
  return result.rows[0].id;
}

async function buscarVigentePorToken(token, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, sucursal_id, valido_hasta
     FROM qr_token
     WHERE token = $1 AND valido_hasta > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

module.exports = { buscarVigentePorSucursal, crear, buscarVigentePorToken };
