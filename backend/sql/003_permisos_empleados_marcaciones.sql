-- 003_permisos_empleados_marcaciones.sql
-- Siembra el permiso de rrhh_admin sobre los módulos "empleados" y "marcaciones"
-- (enrolamiento de dispositivo/biometría y panel de revisión de marcaciones).

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'empleados', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'marcaciones', TRUE, FALSE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
