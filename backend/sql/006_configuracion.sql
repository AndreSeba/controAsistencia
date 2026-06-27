-- 006_configuracion.sql
-- Tabla genérica de configuración clave/valor para parámetros editables por RRHH
-- (hoy: margen de anticipación para marcar entrada).

CREATE TABLE IF NOT EXISTS configuracion (
    clave            VARCHAR(50) NOT NULL PRIMARY KEY,
    valor            VARCHAR(50) NOT NULL,
    actualizado_por  INT NULL REFERENCES usuarios(id),
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracion (clave, valor) VALUES ('margen_anticipacion_min', '30')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'configuracion', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
