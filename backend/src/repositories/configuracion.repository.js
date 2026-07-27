const { getPool } = require('../config/db');

async function obtener(clave, executor = getPool()) {
  const result = await executor.query('SELECT clave, valor FROM configuracion WHERE clave = $1', [clave]);
  return result.rows[0] || null;
}

// UPSERT, no UPDATE a secas: esta tabla es clave/valor genérica y una clave nueva no
// tiene fila hasta que se guarda por primera vez. Con el UPDATE original, guardar una
// clave no sembrada por migración (le pasó a `logo_url` el 2026-07-26) afectaba 0 filas
// y se perdía en silencio — sin error, pero sin guardar nada.
async function actualizar(clave, valor, usuarioId, executor = getPool()) {
  await executor.query(
    `INSERT INTO configuracion (clave, valor, actualizado_por, actualizado_en)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (clave) DO UPDATE
       SET valor = EXCLUDED.valor,
           actualizado_por = EXCLUDED.actualizado_por,
           actualizado_en = NOW()`,
    [clave, valor, usuarioId]
  );
}

module.exports = { obtener, actualizar };
