const { getPool } = require('../config/db');

async function crear({ nombre, apellido, documentoNro, hrmsRef, areaTurnoId, telefono, esSupervisor, fechaIngreso, fechaRetiro }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO empleado (nombre, apellido, documento_nro, hrms_ref, area_turno_id, telefono, es_supervisor, fecha_ingreso, fecha_retiro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [nombre, apellido, documentoNro, hrmsRef || null, areaTurnoId || null, telefono || null, esSupervisor === true, fechaIngreso || null, fechaRetiro || null]
  );
  return result.rows[0].id;
}

async function actualizar(id, { nombre, apellido, documentoNro, estado, hrmsRef, areaTurnoId, telefono, esSupervisor, fechaIngreso, fechaRetiro }, executor = getPool()) {
  await executor.query(
    `UPDATE empleado
     SET nombre = $1, apellido = $2, documento_nro = $3, estado = COALESCE($4, estado), hrms_ref = $5,
         area_turno_id = $6, telefono = $7, es_supervisor = $8, fecha_ingreso = $9, fecha_retiro = $10
     WHERE id = $11`,
    [nombre, apellido, documentoNro, estado, hrmsRef || null, areaTurnoId || null, telefono || null, esSupervisor === true, fechaIngreso || null, fechaRetiro || null, id]
  );
}

async function buscarPorDocumento(documentoNro, executor = getPool()) {
  const result = await executor.query(
    'SELECT id, nombre, apellido FROM empleado WHERE documento_nro = $1',
    [documentoNro]
  );
  return result.rows[0] || null;
}

// Para la auto-activación (CI + selfie): a diferencia de buscarPorDocumento (que no
// filtra por estado y se usa para detectar duplicados en alta/edición), acá solo un
// empleado ACTIVO puede auto-activarse.
async function buscarActivoPorDocumento(documentoNro, executor = getPool()) {
  const result = await executor.query(
    "SELECT id FROM empleado WHERE documento_nro = $1 AND estado = 'activo'",
    [documentoNro]
  );
  return result.rows[0] || null;
}

async function listar(incluirInactivos) {
  const pool = getPool();
  const where = incluirInactivos ? '' : "WHERE e.estado = 'activo'";
  const result = await pool.query(`
    SELECT e.id, e.nombre, e.apellido, e.documento_nro, e.estado, e.hrms_ref, e.created_at,
           e.area_turno_id, e.telefono, e.es_supervisor,
           e.fecha_ingreso::text AS fecha_ingreso, e.fecha_retiro::text AS fecha_retiro,
           tc.nombre AS area_nombre,
           d.id AS dispositivo_id, b.id AS biometria_id
    FROM empleado e
    LEFT JOIN turno_catalogo tc ON tc.id = e.area_turno_id
    LEFT JOIN dispositivo_empleado d ON d.empleado_id = e.id AND d.estado = 'activo'
    LEFT JOIN enrolamiento_biometrico b ON b.empleado_id = e.id AND b.estado = 'activo'
    ${where}
    ORDER BY e.apellido, e.nombre
  `);
  return result.rows;
}

async function obtenerPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT e.id, e.nombre, e.apellido, e.documento_nro, e.estado, e.hrms_ref, e.created_at,
            e.area_turno_id, e.telefono, e.es_supervisor,
            e.fecha_ingreso::text AS fecha_ingreso, e.fecha_retiro::text AS fecha_retiro,
            tc.nombre AS area_nombre
     FROM empleado e
     LEFT JOIN turno_catalogo tc ON tc.id = e.area_turno_id
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { crear, actualizar, buscarPorDocumento, buscarActivoPorDocumento, listar, obtenerPorId };
