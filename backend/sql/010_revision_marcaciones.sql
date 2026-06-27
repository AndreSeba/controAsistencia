-- 010_revision_marcaciones.sql
-- Permite a RRHH marcar una marcación requiere_revision como revisada (quién y cuándo),
-- sin tocar el campo `estado` (esa es la señal original congelada, no se re-juzga).
-- También habilita el permiso de edición sobre el módulo "marcaciones": hasta ahora
-- rrhh_admin solo tenía puede_ver, porque el módulo era de solo lectura.

ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS revisado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS revisado_por INT NULL REFERENCES usuarios(id);
ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMPTZ NULL;

UPDATE rol_permisos SET puede_editar = TRUE
WHERE modulo = 'marcaciones'
  AND rol_id = (SELECT id FROM roles WHERE nombre = 'rrhh_admin');
