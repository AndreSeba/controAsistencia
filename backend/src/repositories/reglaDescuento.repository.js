const { getPool } = require('../config/db');

// Banda vigente para un atraso dado: la fila cuyo rango [banda_min, banda_max] lo
// cubre, tomando la generación más reciente (vigente_desde) si hubiera bandas
// superpuestas de distintas épocas.
async function buscarPorMinutosAtraso(minutosAtraso, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, banda_min, banda_max, monto_bs, vigente_desde
     FROM regla_descuento
     WHERE banda_min <= $1
       AND (banda_max IS NULL OR $1 <= banda_max)
       AND vigente_desde <= CURRENT_DATE
     ORDER BY vigente_desde DESC
     LIMIT 1`,
    [minutosAtraso]
  );
  return result.rows[0] || null;
}

async function listar() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT id, banda_min, banda_max, monto_bs, vigente_desde
    FROM regla_descuento
    ORDER BY banda_min
  `);
  return result.rows;
}

module.exports = { buscarPorMinutosAtraso, listar };
