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

async function crear({ empleadoId, deviceToken, activacionToken, aprobadoPorRrhh }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO dispositivo_empleado (empleado_id, device_token, activacion_token, aprobado_por_rrhh)
     VALUES ($1, $2, $3, $4)
     RETURNING id, fecha_registro`,
    [empleadoId, deviceToken, activacionToken, aprobadoPorRrhh]
  );
  return result.rows[0];
}

async function revocar(id, executor = getPool()) {
  await executor.query("UPDATE dispositivo_empleado SET estado = 'revocado' WHERE id = $1", [id]);
}

// Reemplaza el código de activación por uno nuevo (invalida cualquier link viejo
// sin usar) — no toca el device_token real, así no rompe el dispositivo ya activado.
async function generarActivacion(id, activacionToken, executor = getPool()) {
  await executor.query(
    `UPDATE dispositivo_empleado SET activacion_token = $2, activacion_usado_en = NULL WHERE id = $1`,
    [id, activacionToken]
  );
}

async function buscarPorActivacionToken(activacionToken, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, empleado_id, device_token
     FROM dispositivo_empleado
     WHERE activacion_token = $1 AND activacion_usado_en IS NULL AND estado = 'activo'`,
    [activacionToken]
  );
  return result.rows[0] || null;
}

async function marcarActivacionUsada(id, executor = getPool()) {
  await executor.query(
    `UPDATE dispositivo_empleado SET activacion_usado_en = NOW(), activacion_token = NULL WHERE id = $1`,
    [id]
  );
}

module.exports = {
  buscarActivoPorEmpleado,
  buscarPorToken,
  crear,
  revocar,
  generarActivacion,
  buscarPorActivacionToken,
  marcarActivacionUsada,
};
