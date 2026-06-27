const { getPool } = require('../config/db');

async function buscarActivoPorEmpleado(empleadoId, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, empleado_id, estado, fecha_registro, aprobado_por_rrhh, device_token
     FROM dispositivo_empleado
     WHERE empleado_id = $1 AND estado = 'activo'`,
    [empleadoId]
  );
  return result.rows[0] || null;
}

async function buscarPorToken(deviceToken, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, empleado_id, estado
     FROM dispositivo_empleado
     WHERE device_token = $1 AND estado = 'activo'`,
    [deviceToken]
  );
  return result.rows[0] || null;
}

async function crear({ empleadoId, deviceToken, aprobadoPorRrhh }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO dispositivo_empleado (empleado_id, device_token, aprobado_por_rrhh)
     VALUES ($1, $2, $3)
     RETURNING id, fecha_registro`,
    [empleadoId, deviceToken, aprobadoPorRrhh]
  );
  return result.rows[0];
}

async function revocar(id, executor = getPool()) {
  await executor.query("UPDATE dispositivo_empleado SET estado = 'revocado' WHERE id = $1", [id]);
}

module.exports = { buscarActivoPorEmpleado, buscarPorToken, crear, revocar };
