const { getPool } = require('../config/db');

async function listar(incluirInactivas) {
  const pool = getPool();
  const where = incluirInactivas ? '' : 'WHERE activo = TRUE';
  const result = await pool.query(`
    SELECT id, nombre, geo_lat, geo_lng, geo_radio_m, wifi_bssid,
           geo_actualizado_por, geo_actualizado_en, activo
    FROM sucursal
    ${where}
    ORDER BY nombre
  `);
  return result.rows;
}

async function obtenerPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, nombre, geo_lat, geo_lng, geo_radio_m, wifi_bssid,
            geo_actualizado_por, geo_actualizado_en, activo, totp_secret
     FROM sucursal
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function crear({ nombre, geoLat, geoLng, geoRadioM, wifiBssid, usuarioId }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO sucursal (nombre, geo_lat, geo_lng, geo_radio_m, wifi_bssid, geo_actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [nombre, geoLat, geoLng, geoRadioM, wifiBssid || null, usuarioId]
  );
  return result.rows[0].id;
}

async function actualizarDatos(id, { nombre, activo }, executor = getPool()) {
  await executor.query(
    'UPDATE sucursal SET nombre = $1, activo = $2 WHERE id = $3',
    [nombre, activo, id]
  );
}

async function actualizarGeocerca(id, { geoLat, geoLng, geoRadioM, wifiBssid, usuarioId }, executor = getPool()) {
  await executor.query(
    `UPDATE sucursal
     SET geo_lat = $1,
         geo_lng = $2,
         geo_radio_m = $3,
         wifi_bssid = $4,
         geo_actualizado_por = $5,
         geo_actualizado_en = NOW()
     WHERE id = $6`,
    [geoLat, geoLng, geoRadioM, wifiBssid || null, usuarioId, id]
  );
}

module.exports = { listar, obtenerPorId, crear, actualizarDatos, actualizarGeocerca };
