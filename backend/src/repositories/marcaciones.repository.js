const { getPool } = require('../config/db');

async function crear(datos, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO marcacion (
       empleado_id, turno_jornada_id, sucursal_id, device_token, tipo, timestamp_utc,
       gps_lat, gps_lng, gps_precision_m, dentro_geocerca,
       geo_centro_lat_aplicado, geo_centro_lng_aplicado, geo_radio_aplicado,
       qr_token_id, selfie_url, liveness_ok, liveness_reto_id, face_match_score,
       identidad_verificada, minutos_atraso, minutos_anticipacion, estado
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13,
       $14, $15, $16, $17, $18,
       $19, $20, $21, $22
     )
     RETURNING id, tipo, estado, timestamp_utc`,
    [
      datos.empleadoId, datos.turnoJornadaId, datos.sucursalId, datos.deviceToken, datos.tipo, datos.timestampUtc,
      datos.gpsLat, datos.gpsLng, datos.gpsPrecisionM, datos.dentroGeocerca,
      datos.geoCentroLatAplicado, datos.geoCentroLngAplicado, datos.geoRadioAplicado,
      datos.qrTokenId, datos.selfieUrl, datos.livenessOk, datos.livenessRetoId, datos.faceMatchScore,
      datos.identidadVerificada, datos.minutosAtraso, datos.minutosAnticipacion, datos.estado,
    ]
  );
  return result.rows[0];
}

async function listar({ empleadoId, sucursalId, estado, tipo, revisado } = {}) {
  const pool = getPool();
  const condiciones = [];
  const params = [];
  if (empleadoId) { params.push(empleadoId); condiciones.push(`m.empleado_id = $${params.length}`); }
  if (sucursalId) { params.push(sucursalId); condiciones.push(`m.sucursal_id = $${params.length}`); }
  if (estado) { params.push(estado); condiciones.push(`m.estado = $${params.length}`); }
  if (tipo) { params.push(tipo); condiciones.push(`m.tipo = $${params.length}`); }
  if (revisado != null) { params.push(revisado); condiciones.push(`m.revisado = $${params.length}`); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT m.id, m.empleado_id, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
            e.documento_nro AS empleado_documento_nro,
            m.sucursal_id, s.nombre AS sucursal_nombre,
            m.tipo, m.timestamp_utc, m.dentro_geocerca, m.selfie_url, m.liveness_ok,
            m.face_match_score, m.identidad_verificada, m.minutos_atraso, m.minutos_anticipacion, m.estado,
            m.revisado, m.revisado_en, ru.nombre AS revisado_por_nombre
     FROM marcacion m
     JOIN empleado e ON e.id = m.empleado_id
     JOIN sucursal s ON s.id = m.sucursal_id
     LEFT JOIN usuarios ru ON ru.id = m.revisado_por
     ${where}
     ORDER BY m.timestamp_utc DESC`,
    params
  );
  return result.rows;
}

async function obtenerPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, empleado_id, sucursal_id, tipo, estado, revisado, revisado_por, revisado_en
     FROM marcacion
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function marcarRevisado(id, usuarioId, executor = getPool()) {
  const result = await executor.query(
    `UPDATE marcacion
     SET revisado = TRUE, revisado_por = $1, revisado_en = NOW()
     WHERE id = $2
     RETURNING id, revisado, revisado_en`,
    [usuarioId, id]
  );
  return result.rows[0];
}

module.exports = { crear, listar, obtenerPorId, marcarRevisado };
