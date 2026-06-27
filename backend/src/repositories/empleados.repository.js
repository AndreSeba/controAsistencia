const { getPool } = require('../config/db');

async function crear({ nombre, apellido, documentoNro, hrmsRef }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO empleado (nombre, apellido, documento_nro, hrms_ref)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [nombre, apellido, documentoNro, hrmsRef || null]
  );
  return result.rows[0].id;
}

async function buscarPorDocumento(documentoNro, executor = getPool()) {
  const result = await executor.query(
    'SELECT id, nombre, apellido FROM empleado WHERE documento_nro = $1',
    [documentoNro]
  );
  return result.rows[0] || null;
}

async function listar(incluirInactivos) {
  const pool = getPool();
  const where = incluirInactivos ? '' : "WHERE e.estado = 'activo'";
  const result = await pool.query(`
    SELECT e.id, e.nombre, e.apellido, e.documento_nro, e.estado, e.hrms_ref, e.created_at,
           d.id AS dispositivo_id, b.id AS biometria_id
    FROM empleado e
    LEFT JOIN dispositivo_empleado d ON d.empleado_id = e.id AND d.estado = 'activo'
    LEFT JOIN enrolamiento_biometrico b ON b.empleado_id = e.id AND b.estado = 'activo'
    ${where}
    ORDER BY e.apellido, e.nombre
  `);
  return result.rows;
}

async function obtenerPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, nombre, apellido, documento_nro, estado, hrms_ref, created_at
     FROM empleado
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { crear, buscarPorDocumento, listar, obtenerPorId };
