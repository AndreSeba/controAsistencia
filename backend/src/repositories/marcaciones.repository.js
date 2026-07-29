const { getPool } = require('../config/db');

async function crear({
  empleadoId, turnoJornadaId, sucursalId, deviceToken, tipo, timestampUtc,
  gpsLat, gpsLng, gpsPrecisionM, dentroGeocerca,
  geoCentroLatAplicado, geoCentroLngAplicado, geoRadioAplicado,
  qrTokenId, selfieUrl, livenessOk, livenessRetoId, faceMatchScore,
  identidadVerificada, minutosAtraso, minutosAnticipacion,
  estado,
  offlineMode = false,
  totpToken = null,
}, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO marcacion (
       empleado_id, turno_jornada_id, sucursal_id, device_token, tipo, timestamp_utc,
       gps_lat, gps_lng, gps_precision_m, dentro_geocerca,
       geo_centro_lat_aplicado, geo_centro_lng_aplicado, geo_radio_aplicado,
       qr_token_id, selfie_url, liveness_ok, liveness_reto_id, face_match_score,
       identidad_verificada, minutos_atraso, minutos_anticipacion, estado,
       offline_mode, totp_token
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13,
       $14, $15, $16, $17, $18,
       $19, $20, $21, $22,
       $23, $24
     )
     RETURNING id, tipo, estado, timestamp_utc`,
    [
      empleadoId, turnoJornadaId, sucursalId, deviceToken, tipo, timestampUtc,
      gpsLat, gpsLng, gpsPrecisionM, dentroGeocerca,
      geoCentroLatAplicado, geoCentroLngAplicado, geoRadioAplicado,
      qrTokenId, selfieUrl, livenessOk, livenessRetoId, faceMatchScore,
      identidadVerificada, minutosAtraso, minutosAnticipacion, estado,
      offlineMode, totpToken,
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

// ¿Alguna marcación de esta jornada quedó marcada para revisión? Se usa al cerrar la
// jornada: el flag de turno_jornada tiene que reflejar la jornada COMPLETA (entrada y
// salida), no solo la marcación que la cierra.
async function existeRequiereRevisionEnJornada(turnoJornadaId, executor = getPool()) {
  const result = await executor.query(
    `SELECT EXISTS (
       SELECT 1 FROM marcacion
       WHERE turno_jornada_id = $1 AND estado = 'requiere_revision'
     ) AS hay`,
    [turnoJornadaId]
  );
  return result.rows[0].hay;
}

async function obtenerRankingAtrasos(fechaInicio, fechaFin) {
  const pool = getPool();
  
  let filtroFecha = '';
  const params = [];
  
  if (fechaInicio && fechaFin) {
    filtroFecha = `AND m.timestamp_utc >= $1 AND m.timestamp_utc <= $2`;
    params.push(fechaInicio, fechaFin);
  }

  const rankingSucursales = await pool.query(
    `SELECT 
       s.id, s.nombre,
       SUM(CASE WHEN m.minutos_atraso = 0 THEN 1 ELSE 0 END) as a_tiempo,
       SUM(CASE WHEN m.minutos_atraso > 0 THEN 1 ELSE 0 END) as atrasos
     FROM marcacion m
     JOIN sucursal s ON s.id = m.sucursal_id
     WHERE m.tipo = 'ENTRADA' ${filtroFecha}
     GROUP BY s.id, s.nombre`,
     params
  );

  const rankingEmpleados = await pool.query(
    `SELECT 
       e.id, e.nombre, e.apellido,
       SUM(CASE WHEN m.minutos_atraso = 0 THEN 1 ELSE 0 END) as a_tiempo,
       SUM(CASE WHEN m.minutos_atraso > 0 THEN 1 ELSE 0 END) as atrasos
     FROM marcacion m
     JOIN empleado e ON e.id = m.empleado_id
     WHERE m.tipo = 'ENTRADA' ${filtroFecha}
     GROUP BY e.id, e.nombre, e.apellido`,
     params
  );

  return {
    sucursales: rankingSucursales.rows,
    empleados: rankingEmpleados.rows
  };
}

async function asistenciaSemanal({ fechaInicio, fechaFin, sucursalId, turnoId, empleadoId } = {}) {
  const pool = getPool();
  const params = [fechaInicio, fechaFin];
  const extras = [];
  if (sucursalId) { params.push(sucursalId); extras.push(`AND tj.sucursal_id = $${params.length}`); }
  if (turnoId)    { params.push(turnoId);    extras.push(`AND tj.turno_catalogo_id = $${params.length}`); }
  if (empleadoId) { params.push(empleadoId); extras.push(`AND tj.empleado_id = $${params.length}`); }

  const result = await pool.query(
    `SELECT
       e.id            AS empleado_id,
       e.nombre        AS empleado_nombre,
       e.apellido      AS empleado_apellido,
       e.documento_nro AS empleado_documento_nro,
       tj.id           AS jornada_id,
       tj.fecha,
       tc.id           AS turno_id,
       tc.nombre       AS turno_nombre,
       tj.sucursal_id,
       s.nombre        AS sucursal_nombre,
       tj.requiere_revision,
       tj.cierre_automatico,
       tj.salida_marcada,
       tj.estado       AS jornada_estado,
       m_e.timestamp_utc AS hora_entrada,
       m_e.minutos_atraso,
       m_e.minutos_anticipacion,
       m_e.identidad_verificada,
       m_s.timestamp_utc AS hora_salida
     FROM turno_jornada tj
     JOIN empleado       e  ON e.id  = tj.empleado_id
     JOIN turno_catalogo tc ON tc.id = tj.turno_catalogo_id
     JOIN sucursal       s  ON s.id  = tj.sucursal_id
     LEFT JOIN marcacion m_e ON m_e.turno_jornada_id = tj.id AND m_e.tipo = 'ENTRADA'
     LEFT JOIN marcacion m_s ON m_s.turno_jornada_id = tj.id AND m_s.tipo = 'SALIDA'
     WHERE tj.fecha >= $1 AND tj.fecha <= $2
       ${extras.join(' ')}
     ORDER BY e.apellido, e.nombre, tj.fecha, tc.hora_inicio`,
    params
  );
  return result.rows;
}

module.exports = {
  crear, listar, obtenerPorId, marcarRevisado, existeRequiereRevisionEnJornada,
  obtenerRankingAtrasos, asistenciaSemanal,
};
