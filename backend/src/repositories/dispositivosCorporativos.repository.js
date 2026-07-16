const { getPool } = require('../config/db');

async function listar(executor = getPool()) {
  const result = await executor.query(
    `SELECT dc.id, dc.sucursal_id, s.nombre AS sucursal_nombre, dc.nombre, dc.estado,
            dc.fecha_registro, dc.sucursal_actualizada_en
     FROM dispositivo_corporativo dc
     JOIN sucursal s ON s.id = dc.sucursal_id
     ORDER BY s.nombre, dc.nombre`
  );
  return result.rows;
}

async function obtenerPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT dc.id, dc.sucursal_id, s.nombre AS sucursal_nombre, dc.nombre, dc.estado,
            dc.device_token, dc.fecha_registro
     FROM dispositivo_corporativo dc
     JOIN sucursal s ON s.id = dc.sucursal_id
     WHERE dc.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function buscarPorToken(deviceToken, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, sucursal_id, nombre, estado
     FROM dispositivo_corporativo
     WHERE device_token = $1 AND estado = 'activo'`,
    [deviceToken]
  );
  return result.rows[0] || null;
}

async function crear({ sucursalId, nombre, deviceToken, aprobadoPorRrhh }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO dispositivo_corporativo (sucursal_id, nombre, device_token, aprobado_por_rrhh)
     VALUES ($1, $2, $3, $4)
     RETURNING id, fecha_registro`,
    [sucursalId, nombre, deviceToken, aprobadoPorRrhh]
  );
  return result.rows[0];
}

async function actualizarSucursal(id, { sucursalId, usuarioId }, executor = getPool()) {
  await executor.query(
    `UPDATE dispositivo_corporativo
     SET sucursal_id = $1, sucursal_actualizada_por = $2, sucursal_actualizada_en = NOW()
     WHERE id = $3`,
    [sucursalId, usuarioId, id]
  );
}

async function revocar(id, executor = getPool()) {
  await executor.query("UPDATE dispositivo_corporativo SET estado = 'revocado' WHERE id = $1", [id]);
}

async function listarEmpleadosHabilitados(dispositivoCorporativoId, executor = getPool()) {
  const result = await executor.query(
    `SELECT dce.id AS habilitacion_id, e.id AS empleado_id, e.nombre, e.apellido, e.es_supervisor,
            b.foto_referencia_url
     FROM dispositivo_corporativo_empleado dce
     JOIN empleado e ON e.id = dce.empleado_id
     LEFT JOIN enrolamiento_biometrico b ON b.empleado_id = e.id AND b.estado = 'activo'
     WHERE dce.dispositivo_corporativo_id = $1 AND dce.estado = 'activo' AND e.estado = 'activo'
     ORDER BY e.apellido, e.nombre`,
    [dispositivoCorporativoId]
  );
  return result.rows;
}

async function buscarHabilitacion(dispositivoCorporativoId, empleadoId, executor = getPool()) {
  const result = await executor.query(
    `SELECT id FROM dispositivo_corporativo_empleado
     WHERE dispositivo_corporativo_id = $1 AND empleado_id = $2 AND estado = 'activo'`,
    [dispositivoCorporativoId, empleadoId]
  );
  return result.rows[0] || null;
}

async function habilitarEmpleado({ dispositivoCorporativoId, empleadoId, usuarioId }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO dispositivo_corporativo_empleado (dispositivo_corporativo_id, empleado_id, habilitado_por_rrhh)
     VALUES ($1, $2, $3)
     RETURNING id, fecha_registro`,
    [dispositivoCorporativoId, empleadoId, usuarioId]
  );
  return result.rows[0];
}

async function deshabilitarEmpleado(habilitacionId, executor = getPool()) {
  await executor.query("UPDATE dispositivo_corporativo_empleado SET estado = 'revocado' WHERE id = $1", [habilitacionId]);
}

module.exports = {
  listar,
  obtenerPorId,
  buscarPorToken,
  crear,
  actualizarSucursal,
  revocar,
  listarEmpleadosHabilitados,
  buscarHabilitacion,
  habilitarEmpleado,
  deshabilitarEmpleado,
};
