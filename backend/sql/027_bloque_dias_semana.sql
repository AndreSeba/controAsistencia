-- 027_bloque_dias_semana.sql
-- Propuesta 2026-07-31: Administración tiene un horario de sábado distinto (09:00-13:00,
-- un solo bloque) y no trabaja domingo — hoy un bloque aplica TODOS los días igual, sin
-- ningún concepto de "día de la semana". Días 1-7 = lunes..domingo (ISO), array vacío no
-- permitido a nivel de aplicación (validado en turnos.service.js). Default = los 7 días,
-- para que ningún bloque existente cambie de comportamiento hasta que RRHH lo edite.
ALTER TABLE turno_bloque
    ADD COLUMN IF NOT EXISTS dias_semana SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}';
