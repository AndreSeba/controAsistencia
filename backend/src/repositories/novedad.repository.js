const { getPool } = require('../config/db');

async function listar({ empleadoId, fechaInicio, fechaFin } = {}) {
  const pool = getPool();
  const params = [fechaInicio, fechaFin];
  const filtros = ['fecha BETWEEN $1 AND $2'];
  if (empleadoId) { params.push(empleadoId); filtros.push(`empleado_id = $${params.length}`); }

  const result = await pool.query(
    `SELECT id, empleado_id, fecha::text, tipo, nota FROM novedad WHERE ${filtros.join(' AND ')}`,
    params
  );
  return result.rows;
}

async function upsert({ empleadoId, fecha, tipo, nota, usuarioId }) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO novedad (empleado_id, fecha, tipo, nota, registrado_por)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empleado_id, fecha)
     DO UPDATE SET tipo = EXCLUDED.tipo, nota = EXCLUDED.nota, registrado_por = EXCLUDED.registrado_por, created_at = NOW()
     RETURNING id`,
    [Number(empleadoId), fecha, tipo, nota || null, usuarioId]
  );
  return result.rows[0];
}

async function eliminar({ empleadoId, fecha }) {
  const pool = getPool();
  await pool.query('DELETE FROM novedad WHERE empleado_id = $1 AND fecha = $2', [empleadoId, fecha]);
}

module.exports = { listar, upsert, eliminar };
