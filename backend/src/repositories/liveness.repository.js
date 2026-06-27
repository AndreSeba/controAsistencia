const { getPool } = require('../config/db');

async function crearReto({ empleadoId, nonce, tipoReto, expira }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO liveness_reto (empleado_id, nonce, tipo_reto, expira)
     VALUES ($1, $2, $3, $4)
     RETURNING id, emitido`,
    [empleadoId, nonce, tipoReto, expira]
  );
  return result.rows[0];
}

async function buscarPorNonce(nonce, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, empleado_id, nonce, tipo_reto, expira, usado
     FROM liveness_reto
     WHERE nonce = $1`,
    [nonce]
  );
  return result.rows[0] || null;
}

async function marcarUsado(id, executor = getPool()) {
  await executor.query('UPDATE liveness_reto SET usado = TRUE WHERE id = $1', [id]);
}

module.exports = { crearReto, buscarPorNonce, marcarUsado };
