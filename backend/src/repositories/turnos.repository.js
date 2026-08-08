const { getPool } = require('../config/db');

async function listarCatalogo() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT tc.id, tc.nombre, tc.activo, tc.aplica_descuento, tc.aplica_pago_diario, tc.requiere_salida,
           json_agg(
             json_build_object(
               'numero_bloque', tb.numero_bloque,
               'hora_inicio', to_char(tb.hora_inicio, 'HH24:MI'),
               'hora_fin', to_char(tb.hora_fin, 'HH24:MI'),
               'dias_semana', tb.dias_semana
             ) ORDER BY tb.numero_bloque
           ) AS bloques
    FROM turno_catalogo tc
    LEFT JOIN turno_bloque tb ON tb.turno_catalogo_id = tc.id
    WHERE tc.activo = TRUE
    GROUP BY tc.id, tc.nombre, tc.activo, tc.aplica_descuento, tc.aplica_pago_diario, tc.requiere_salida
    ORDER BY MIN(tb.hora_inicio)
  `);
  // Si un área no tiene bloques (no debería pasar), devolver array vacío en vez de [null].
  return result.rows.map((r) => ({
    ...r,
    bloques: r.bloques?.[0] === null ? [] : r.bloques,
  }));
}

async function obtenerCatalogoPorId(id, executor = getPool()) {
  const result = await executor.query(
    `SELECT tc.id, tc.nombre, tc.activo, tc.aplica_descuento, tc.aplica_pago_diario, tc.requiere_salida,
            json_agg(
              json_build_object(
                'numero_bloque', tb.numero_bloque,
                'hora_inicio', to_char(tb.hora_inicio, 'HH24:MI'),
                'hora_fin', to_char(tb.hora_fin, 'HH24:MI'),
                'dias_semana', tb.dias_semana
              ) ORDER BY tb.numero_bloque
            ) AS bloques
     FROM turno_catalogo tc
     LEFT JOIN turno_bloque tb ON tb.turno_catalogo_id = tc.id
     WHERE tc.id = $1
     GROUP BY tc.id, tc.nombre, tc.activo, tc.aplica_descuento, tc.aplica_pago_diario, tc.requiere_salida`,
    [id]
  );
  if (!result.rows[0]) return null;
  const r = result.rows[0];
  return { ...r, bloques: r.bloques?.[0] === null ? [] : r.bloques };
}

async function crearCatalogo({ nombre, bloques, aplicaDescuento, aplicaPagoDiario, requiereSalida }, executor = getPool()) {
  // Insertar el área sin hora_inicio/hora_fin propias (se usan los del primer bloque
  // como fallback para retrocompatibilidad de columnas legacy).
  const primerBloque = bloques[0];
  const result = await executor.query(
    `INSERT INTO turno_catalogo (nombre, hora_inicio, hora_fin, aplica_descuento, aplica_pago_diario, requiere_salida)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [nombre, primerBloque.horaInicio, primerBloque.horaFin, aplicaDescuento, aplicaPagoDiario, requiereSalida]
  );
  const turnoId = result.rows[0].id;

  for (let i = 0; i < bloques.length; i++) {
    await executor.query(
      `INSERT INTO turno_bloque (turno_catalogo_id, numero_bloque, hora_inicio, hora_fin, dias_semana)
       VALUES ($1, $2, $3, $4, $5)`,
      [turnoId, i + 1, bloques[i].horaInicio, bloques[i].horaFin, bloques[i].diasSemana]
    );
  }

  return turnoId;
}

// Borrado lógico: las jornadas históricas siguen referenciando el turno.
async function desactivarCatalogo(id, executor = getPool()) {
  await executor.query('UPDATE turno_catalogo SET activo = FALSE WHERE id = $1', [id]);
}

async function contarEmpleadosAsignados(id, executor = getPool()) {
  const result = await executor.query(
    "SELECT COUNT(*)::int AS n FROM empleado WHERE area_turno_id = $1 AND estado = 'activo'",
    [id]
  );
  return result.rows[0].n;
}

async function actualizar(id, { nombre, bloques, aplicaDescuento, aplicaPagoDiario, requiereSalida }, executor = getPool()) {
  // Actualizar nombre, flags de descuento/pago/salida y columnas legacy.
  const primerBloque = bloques[0];
  await executor.query(
    'UPDATE turno_catalogo SET nombre = $1, hora_inicio = $2, hora_fin = $3, aplica_descuento = $4, aplica_pago_diario = $5, requiere_salida = $6 WHERE id = $7',
    [nombre, primerBloque.horaInicio, primerBloque.horaFin, aplicaDescuento, aplicaPagoDiario, requiereSalida, id]
  );

  // Reemplazar bloques: DELETE + re-INSERT (más simple que hacer diffs).
  await executor.query('DELETE FROM turno_bloque WHERE turno_catalogo_id = $1', [id]);

  for (let i = 0; i < bloques.length; i++) {
    await executor.query(
      `INSERT INTO turno_bloque (turno_catalogo_id, numero_bloque, hora_inicio, hora_fin, dias_semana)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, i + 1, bloques[i].horaInicio, bloques[i].horaFin, bloques[i].diasSemana]
    );
  }
}

async function buscarAbiertaPorEmpleado(empleadoId, executor = getPool()) {
  const result = await executor.query(
    `SELECT j.id, j.empleado_id, j.sucursal_id, j.fecha, j.turno_catalogo_id, j.estado,
            tc.aplica_descuento,
            json_agg(
              json_build_object(
                'numero_bloque', tb.numero_bloque,
                'hora_inicio', to_char(tb.hora_inicio, 'HH24:MI'),
                'hora_fin', to_char(tb.hora_fin, 'HH24:MI')
              ) ORDER BY tb.numero_bloque
            ) AS bloques
     FROM turno_jornada j
     JOIN turno_catalogo tc ON tc.id = j.turno_catalogo_id
     LEFT JOIN turno_bloque tb ON tb.turno_catalogo_id = tc.id
     WHERE j.empleado_id = $1 AND j.estado = 'ABIERTO'
     GROUP BY j.id, j.empleado_id, j.sucursal_id, j.fecha, j.turno_catalogo_id, j.estado, tc.aplica_descuento`,
    [empleadoId]
  );
  if (!result.rows[0]) return null;
  const r = result.rows[0];
  return { ...r, bloques: r.bloques?.[0] === null ? [] : r.bloques };
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
  // ABIERTA cuya medianoche (local Bolivia) ya pasó — no el hora_fin del área.
  //
  // Antes cerraba apenas pasaba el hora_fin del ÚLTIMO bloque del área (ej. 18:30 en
  // Administración): alguien que marcaba Entrada tarde y se quedaba trabajando hasta
  // más tarde de lo esperado se encontraba la jornada ya cerrada sola sin haberse ido,
  // y al intentar marcar Salida el servidor respondía "no hay una entrada abierta" sin
  // que la persona entendiera por qué (caso real: Lorena García, 2026-08-04). Cerrar
  // recién a medianoche le da a cualquiera el resto del día para marcar su propia
  // salida real, sin depender de si coincide con el horario configurado del área.
  //
  // fecha + 1 día da la medianoche siguiente como TIMESTAMP naive en hora local; se le
  // suma el offset local->UTC (+4h) y se interpreta explícitamente como UTC para
  // comparar contra NOW() sin depender del timezone de la sesión — mismo patrón que
  // antes, solo que ya no hace falta el JOIN a turno_catalogo/turno_bloque.
  const pool = getPool();
  const result = await pool.query(`
    SELECT j.id
    FROM turno_jornada j
    WHERE j.estado = 'ABIERTO'
      AND ((j.fecha + INTERVAL '1 day') + INTERVAL '4 hours') AT TIME ZONE 'UTC' < NOW()
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
     GROUP BY tc.id, tc.nombre, tc.activo
     HAVING tc.activo = TRUE OR COUNT(j.id) > 0
     ORDER BY tc.nombre`,
    params
  );
  return result.rows;
}

module.exports = {
  listarCatalogo,
  obtenerCatalogoPorId,
  crearCatalogo,
  desactivarCatalogo,
  contarEmpleadosAsignados,
  actualizar,
  buscarAbiertaPorEmpleado,
  crear,
  cerrar,
  listarAbiertasVencidas,
  resumenPorPeriodo,
};
