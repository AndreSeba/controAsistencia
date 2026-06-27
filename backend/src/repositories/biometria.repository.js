const { getPool } = require('../config/db');

async function buscarActivoPorEmpleado(empleadoId, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, empleado_id, face_template_cifrado, foto_referencia_url, fecha
     FROM enrolamiento_biometrico
     WHERE empleado_id = $1 AND estado = 'activo'`,
    [empleadoId]
  );
  return result.rows[0] || null;
}

async function revocarActivos(empleadoId, executor = getPool()) {
  await executor.query(
    "UPDATE enrolamiento_biometrico SET estado = 'revocado' WHERE empleado_id = $1 AND estado = 'activo'",
    [empleadoId]
  );
}

async function crear({ empleadoId, templateCifrado, fotoUrl, enroladoPor }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO enrolamiento_biometrico (empleado_id, face_template_cifrado, foto_referencia_url, enrolado_por)
     VALUES ($1, $2, $3, $4)
     RETURNING id, fecha`,
    [empleadoId, templateCifrado, fotoUrl, enroladoPor]
  );
  return result.rows[0];
}

module.exports = { buscarActivoPorEmpleado, revocarActivos, crear };
