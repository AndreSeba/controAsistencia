const { getPool } = require('../config/db');

async function crear({ empleadoId, sucursalId, gpsLat, gpsLng, dentroGeocerca }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO visita_supervisor (empleado_id, sucursal_id, gps_lat, gps_lng, dentro_geocerca)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, timestamp_utc`,
    [empleadoId, sucursalId, gpsLat ?? null, gpsLng ?? null, dentroGeocerca ?? null]
  );
  return result.rows[0];
}

// Conteo supervisor × sucursal en el rango (fechas locales Bolivia, UTC-4).
async function resumenPorRango(fechaInicio, fechaFin) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT v.empleado_id, e.nombre, e.apellido,
            v.sucursal_id, s.nombre AS sucursal_nombre,
            COUNT(*)::int AS visitas,
            MAX(v.timestamp_utc) AS ultima_visita
     FROM visita_supervisor v
     JOIN empleado e ON e.id = v.empleado_id
     JOIN sucursal s ON s.id = v.sucursal_id
     WHERE (v.timestamp_utc - INTERVAL '4 hours')::date BETWEEN $1 AND $2
     GROUP BY v.empleado_id, e.nombre, e.apellido, v.sucursal_id, s.nombre
     ORDER BY e.apellido, e.nombre, s.nombre`,
    [fechaInicio, fechaFin]
  );
  return result.rows;
}

async function listarPorRango(fechaInicio, fechaFin) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT v.id, v.empleado_id, e.nombre, e.apellido,
            v.sucursal_id, s.nombre AS sucursal_nombre,
            v.timestamp_utc, v.dentro_geocerca
     FROM visita_supervisor v
     JOIN empleado e ON e.id = v.empleado_id
     JOIN sucursal s ON s.id = v.sucursal_id
     WHERE (v.timestamp_utc - INTERVAL '4 hours')::date BETWEEN $1 AND $2
     ORDER BY v.timestamp_utc DESC`,
    [fechaInicio, fechaFin]
  );
  return result.rows;
}

module.exports = { crear, resumenPorRango, listarPorRango };
