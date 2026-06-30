const { getPool } = require('../config/db');

async function listarCatalogo() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT id, nombre, hora_inicio, hora_fin FROM turno_catalogo ORDER BY hora_inicio
  `);
  return result.rows;
}

async function obtenerCatalogoPorId(id, executor = getPool()) {
  const result = await executor.query(
    'SELECT id, nombre, hora_inicio, hora_fin FROM turno_catalogo WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function actualizarHorario(id, { horaInicio, horaFin }, executor = getPool()) {
  await executor.query(
    'UPDATE turno_catalogo SET hora_inicio = $1, hora_fin = $2 WHERE id = $3',
    [horaInicio, horaFin, id]
  );
}

async function buscarAbiertaPorEmpleado(empleadoId, executor = getPool()) {
  const result = await executor.query(
    `SELECT j.id, j.empleado_id, j.sucursal_id, j.fecha, j.turno_catalogo_id, j.estado,
            tc.hora_inicio, tc.hora_fin
     FROM turno_jornada j
     JOIN turno_catalogo tc ON tc.id = j.turno_catalogo_id
     WHERE j.empleado_id = $1 AND j.estado = 'ABIERTO'`,
    [empleadoId]
  );
  return result.rows[0] || null;
}

async function crear({ empleadoId, sucursalId, fecha, turnoCatalogoId }, executor = getPool()) {
  const result = await executor.query(
    `INSERT INTO turno_jornada (empleado_id, sucursal_id, fecha, turno_catalogo_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [empleadoId, sucursalId, fecha, turnoCatalogoId]
  );
  return result.rows[0].id;
}

async function cerrar(id, { salidaMarcada, cierreAutomatico, requiereRevision }, executor = getPool()) {
  await executor.query(
    `UPDATE turno_jornada
     SET estado = 'CERRADO', salida_marcada = $1,
         cierre_automatico = $2, requiere_revision = $3
     WHERE id = $4`,
    [salidaMarcada, cierreAutomatico, requiereRevision, id]
  );
}

async function listarAbiertasVencidas() {
  // ABIERTA cuya hora_fin (local Bolivia) ya pasó respecto a la hora UTC actual.
  // fecha + hora_fin da un TIMESTAMP naive en hora local; se le suma el offset
  // local->UTC (+4h) y se interpreta explícitamente como UTC para comparar contra
  // NOW() sin depender del timezone de la sesión.
  const pool = getPool();
  const result = await pool.query(`
    SELECT j.id
    FROM turno_jornada j
    JOIN turno_catalogo tc ON tc.id = j.turno_catalogo_id
    WHERE j.estado = 'ABIERTO'
      AND ((j.fecha + tc.hora_fin) + INTERVAL '4 hours') AT TIME ZONE 'UTC' < NOW()
  `);
  return result.rows;
}

async function resumenPorPeriodo(fechaInicio, fechaFin) {
  const pool = getPool();
  
  let filtroFecha = '';
  const params = [];
  
  if (fechaInicio && fechaFin) {
    filtroFecha = `AND j.fecha >= $1 AND j.fecha <= $2`;
    params.push(fechaInicio, fechaFin);
  }

  const result = await pool.query(
    `SELECT tc.id, tc.nombre,
            COUNT(j.id) AS entradas,
            COUNT(j.id) FILTER (WHERE j.estado = 'ABIERTO') AS abiertas,
            COUNT(j.id) FILTER (WHERE j.salida_marcada) AS salidas,
            COUNT(j.id) FILTER (WHERE j.requiere_revision) AS requieren_revision
     FROM turno_catalogo tc
     LEFT JOIN turno_jornada j ON j.turno_catalogo_id = tc.id ${filtroFecha}
     GROUP BY tc.id, tc.nombre, tc.hora_inicio
     ORDER BY tc.hora_inicio`,
    params
  );
  return result.rows;
}

module.exports = {
  listarCatalogo,
  obtenerCatalogoPorId,
  actualizarHorario,
  buscarAbiertaPorEmpleado,
  crear,
  cerrar,
  listarAbiertasVencidas,
  resumenPorPeriodo,
};
