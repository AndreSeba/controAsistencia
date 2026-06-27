const { getPool } = require('../config/db');

async function crear({ marcacionId, empleadoId, montoBs, reglaId, periodo }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO descuento (marcacion_id, empleado_id, monto_bs, regla_id, periodo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [marcacionId, empleadoId, montoBs, reglaId, periodo]
  );
  return result.rows[0].id;
}

async function listar({ periodo, estado, empleadoId } = {}) {
  const pool = getPool();
  const condiciones = [];
  const params = [];
  if (periodo) { params.push(periodo); condiciones.push(`d.periodo = $${params.length}`); }
  if (estado) { params.push(estado); condiciones.push(`d.estado = $${params.length}`); }
  if (empleadoId) { params.push(empleadoId); condiciones.push(`d.empleado_id = $${params.length}`); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT d.id, d.marcacion_id, d.empleado_id, e.nombre AS empleado_nombre,
            d.monto_bs, d.regla_id, d.periodo, d.estado, d.aprobado_por,
            m.timestamp_utc, m.minutos_atraso, m.sucursal_id, s.nombre AS sucursal_nombre
     FROM descuento d
     JOIN empleado e ON e.id = d.empleado_id
     JOIN marcacion m ON m.id = d.marcacion_id
     JOIN sucursal s ON s.id = m.sucursal_id
     ${where}
     ORDER BY m.timestamp_utc DESC`,
    params
  );
  return result.rows;
}

async function obtenerPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, marcacion_id, empleado_id, monto_bs, regla_id, periodo, estado, aprobado_por
     FROM descuento
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function actualizarEstado(id, estado, aprobadoPor, executor = getPool()) {
  await executor.query(
    'UPDATE descuento SET estado = $1, aprobado_por = $2 WHERE id = $3',
    [estado, aprobadoPor, id]
  );
}

async function reportePorPeriodo(periodo) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT d.empleado_id, e.nombre AS empleado_nombre,
            COUNT(*) AS cantidad_descuentos,
            SUM(d.monto_bs) AS total_bs,
            SUM(CASE WHEN d.estado = 'aplicado' THEN d.monto_bs ELSE 0 END) AS total_aplicado_bs
     FROM descuento d
     JOIN empleado e ON e.id = d.empleado_id
     WHERE d.periodo = $1
     GROUP BY d.empleado_id, e.nombre
     ORDER BY e.nombre`,
    [periodo]
  );
  return result.rows;
}

module.exports = { crear, listar, obtenerPorId, actualizarEstado, reportePorPeriodo };
