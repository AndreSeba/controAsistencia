const { getPool } = require('../config/db');

async function crear({ empleadoId, sucursalId, gpsLat, gpsLng, dentroGeocerca, tipo }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO visita_supervisor (empleado_id, sucursal_id, gps_lat, gps_lng, dentro_geocerca, tipo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, timestamp_utc, tipo`,
    [empleadoId, sucursalId, gpsLat ?? null, gpsLng ?? null, dentroGeocerca ?? null, tipo]
  );
  return result.rows[0];
}

// Última visita de HOY (fecha local Bolivia) para ese supervisor+sucursal — decide
// si el próximo escaneo es Entrada o Salida. Se reinicia cada día calendario.
async function obtenerUltimoTipoHoy(empleadoId, sucursalId, executor = getPool()) {
  const result = await executor.query(
    `SELECT tipo FROM visita_supervisor
     WHERE empleado_id = $1 AND sucursal_id = $2
       AND (timestamp_utc - INTERVAL '4 hours')::date = (NOW() - INTERVAL '4 hours')::date
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
    [empleadoId, sucursalId]
  );
  return result.rows[0]?.tipo ?? null;
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

// Filas crudas (una por escaneo), con la fecha local ya resuelta como texto
// 'YYYY-MM-DD' (evita el corrimiento de un día que da convertir un DATE de
// Postgres a Date de JS en el navegador). El emparejado Entrada/Salida se arma
// en el service, no acá — esto es solo SQL.
async function listarPorRango(fechaInicio, fechaFin) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT v.id, v.empleado_id, e.nombre, e.apellido,
            v.sucursal_id, s.nombre AS sucursal_nombre,
            v.timestamp_utc, v.tipo, v.dentro_geocerca,
            TO_CHAR(v.timestamp_utc - INTERVAL '4 hours', 'YYYY-MM-DD') AS fecha_local
     FROM visita_supervisor v
     JOIN empleado e ON e.id = v.empleado_id
     JOIN sucursal s ON s.id = v.sucursal_id
     WHERE (v.timestamp_utc - INTERVAL '4 hours')::date BETWEEN $1 AND $2
     ORDER BY v.empleado_id, v.sucursal_id, v.timestamp_utc`,
    [fechaInicio, fechaFin]
  );
  return result.rows;
}

module.exports = { crear, resumenPorRango, listarPorRango, obtenerUltimoTipoHoy };
