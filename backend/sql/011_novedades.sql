-- 011_novedades.sql
-- Tabla de novedades de asistencia: baja médica, permiso, etc.
-- Grano: una novedad por empleado por día (UNIQUE).

CREATE TABLE IF NOT EXISTS novedad (
    id              SERIAL PRIMARY KEY,
    empleado_id     INT NOT NULL REFERENCES empleado(id),
    fecha           DATE NOT NULL,
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN ('baja_medica', 'permiso')),
    nota            TEXT,
    registrado_por  INT REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(empleado_id, fecha)
);

-- Permiso para rrhh_admin
INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'novedades', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;

-- Permiso para admin
INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'novedades', TRUE, TRUE FROM roles WHERE nombre = 'admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
