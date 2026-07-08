const { getPool } = require('../config/db');

// El descuento nace 'aplicado': se descuenta automáticamente al llegar tarde,
// sin pasar por el flujo manual calculado → aprobado → aplicado (decisión 2026-07-03).
async function crear({ marcacionId, empleadoId, montoBs, reglaId, periodo }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO descuento (marcacion_id, empleado_id, monto_bs, regla_id, periodo, estado)
     VALUES ($1, $2, $3, $4, $5, 'aplicado')
     RETURNING id`,
    [marcacionId, empleadoId, montoBs, reglaId, periodo]
  );
  return result.rows[0].id;
}

async function listar({ periodo, fecha, estado, empleadoId } = {}) {
  const pool = getPool();
  const condiciones = [];
  const params = [];
  if (periodo) { params.push(periodo); condiciones.push(`d.periodo = $${params.length}`); }
  // Día calendario local (Bolivia, UTC-4) de la marcación que originó el descuento.
  if (fecha) { params.push(fecha); condiciones.push(`(m.timestamp_utc - INTERVAL '4 hours')::date = $${params.length}`); }
  if (estado) { params.push(estado); condiciones.push(`d.estado = $${params.length}`); }
  if (empleadoId) { params.push(empleadoId); condiciones.push(`d.empleado_id = $${params.length}`); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT d.id, d.marcacion_id, d.empleado_id, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.documento_nro AS empleado_documento_nro,
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

async function reportePorPeriodo({ periodo, fecha } = {}) {
  const pool = getPool();
  const condiciones = [];
  const params = [];
  if (periodo) { params.push(periodo); condiciones.push(`d.periodo = $${params.length}`); }
  if (fecha) { params.push(fecha); condiciones.push(`(m.timestamp_utc - INTERVAL '4 hours')::date = $${params.length}`); }
  const result = await pool.query(
    `SELECT d.empleado_id, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.documento_nro AS empleado_documento_nro,
            COUNT(*) AS cantidad_descuentos,
            SUM(d.monto_bs) AS total_bs,
            SUM(CASE WHEN d.estado = 'aplicado' THEN d.monto_bs ELSE 0 END) AS total_aplicado_bs
     FROM descuento d
     JOIN empleado e ON e.id = d.empleado_id
     JOIN marcacion m ON m.id = d.marcacion_id
     WHERE ${condiciones.join(' AND ')}
     GROUP BY d.empleado_id, e.nombre, e.apellido, e.documento_nro
     ORDER BY e.nombre`,
    params
  );
  return result.rows;
}

// Planilla quincenal: días trabajados (jornadas con fecha en el rango, sin importar
// puntualidad) y descuentos del mismo rango (por fecha local de la marcación).
// El ganado (días × pago_dia_bs) y el total se calculan en el service.
async function planillaPorRango(fechaInicio, fechaFin) {
  const pool = getPool();
  const result = await pool.query(
    `WITH dias AS (
       SELECT tj.empleado_id, COUNT(DISTINCT tj.fecha) AS dias_trabajados
       FROM turno_jornada tj
       WHERE tj.fecha BETWEEN $1 AND $2
       GROUP BY tj.empleado_id
     ),
     dsc AS (
       SELECT d.empleado_id, SUM(d.monto_bs) AS descuentos_bs
       FROM descuento d
       JOIN marcacion m ON m.id = d.marcacion_id
       WHERE (m.timestamp_utc - INTERVAL '4 hours')::date BETWEEN $1 AND $2
       GROUP BY d.empleado_id
     )
     SELECT e.id AS empleado_id, e.nombre, e.apellido, e.documento_nro,
            COALESCE(di.dias_trabajados, 0)::int AS dias_trabajados,
            COALESCE(dsc.descuentos_bs, 0) AS descuentos_bs
     FROM empleado e
     LEFT JOIN dias di ON di.empleado_id = e.id
     LEFT JOIN dsc ON dsc.empleado_id = e.id
     WHERE COALESCE(di.dias_trabajados, 0) > 0 OR COALESCE(dsc.descuentos_bs, 0) > 0
     ORDER BY e.apellido, e.nombre`,
    [fechaInicio, fechaFin]
  );
  return result.rows;
}

async function resumenPorSucursal(tsInicio, tsFin) {
  const pool = getPool();
  let where = "WHERE d.estado = 'aplicado'";
  const params = [];
  if (tsInicio && tsFin) {
    params.push(tsInicio, tsFin);
    where += ` AND m.timestamp_utc >= $1 AND m.timestamp_utc <= $2`;
  }
  const result = await pool.query(
    `SELECT s.id AS sucursal_id, s.nombre AS sucursal_nombre,
            SUM(d.monto_bs) AS total_bs
     FROM descuento d
     JOIN marcacion m ON d.marcacion_id = m.id
     JOIN sucursal s ON m.sucursal_id = s.id
     ${where}
     GROUP BY s.id, s.nombre
     ORDER BY total_bs DESC`,
    params
  );
  return result.rows;
}

module.exports = { crear, listar, obtenerPorId, actualizarEstado, reportePorPeriodo, planillaPorRango, resumenPorSucursal };
