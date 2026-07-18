-- 019_fecha_ingreso_retiro.sql
-- Se agregan fecha_ingreso y fecha_retiro a empleado, cargables desde el alta/edición
-- de Personal en el panel. Ambas NULLABLE: el personal ya cargado no las tiene, RRHH
-- las completa a mano cuando las sabe — nunca se infiere ni se inventa un valor.
--
-- fecha_ingreso ya estaba propuesta (sin construir) como base de antigüedad para el
-- módulo de Vacaciones (P14, ver CLAUDE.md) — se adelanta la carga del dato ahora para
-- que, cuando se construya el módulo, la mayor cantidad de personal ya la tenga
-- cargada en vez de arrancar desde cero. fecha_retiro es nueva: registra la baja del
-- personal (día que dejó de trabajar), útil tanto para reportes históricos como,
-- eventualmente, para no calcular vacaciones más allá de esa fecha.

ALTER TABLE empleado ADD COLUMN IF NOT EXISTS fecha_ingreso DATE NULL;
ALTER TABLE empleado ADD COLUMN IF NOT EXISTS fecha_retiro DATE NULL;
