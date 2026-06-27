const { getPool } = require('../config/db');

async function obtener(clave, executor = getPool()) {
  const result = await executor.query('SELECT clave, valor FROM configuracion WHERE clave = $1', [clave]);
  return result.rows[0] || null;
}

async function actualizar(clave, valor, usuarioId, executor = getPool()) {
  await executor.query(
    `UPDATE configuracion
     SET valor = $1, actualizado_por = $2, actualizado_en = NOW()
     WHERE clave = $3`,
    [valor, usuarioId, clave]
  );
}

module.exports = { obtener, actualizar };
