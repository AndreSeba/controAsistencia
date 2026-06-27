-- 005_permisos_turnos.sql
-- Siembra el permiso de rrhh_admin sobre el módulo "turnos" (editar las horas del
-- catálogo fijo MAÑANA/TARDE).

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'turnos', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
