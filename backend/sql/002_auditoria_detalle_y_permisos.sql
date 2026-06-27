-- 002_auditoria_detalle_y_permisos.sql
-- Extiende auditoria con un campo de detalle (snapshot anterior->nuevo en JSON) y
-- siembra el permiso de rrhh_admin sobre el módulo "sucursales".

ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS detalle TEXT NULL;

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'sucursales', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
