-- 025_dispositivo_autoactivacion.sql
-- Relaja `dispositivo_empleado.aprobado_por_rrhh` a NULLABLE. Hasta ahora todo dispositivo
-- nacía enrolado por un usuario de RRHH (P4: "primer dispositivo aprobado por RRHH, no
-- autoservicio"). La auto-activación con CI + selfie (propuesta 2026-07-29, reabre P4
-- parcialmente) crea el dispositivo sin que ningún usuario de RRHH intervenga — se usa
-- NULL para dejar constancia de que ese dispositivo se auto-activó, distinguible en
-- consultas de `aprobado_por_rrhh IS NULL`. La auditoría del intento (auditoria.repository)
-- es el rastro completo de ese caso, esta columna solo evita romper el INSERT.
ALTER TABLE dispositivo_empleado ALTER COLUMN aprobado_por_rrhh DROP NOT NULL;
