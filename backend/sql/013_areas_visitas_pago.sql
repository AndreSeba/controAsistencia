-- 013_areas_visitas_pago.sql
-- Pedidos del cliente (2026-07-04):
--  1) Pago quincenal: cada día trabajado paga N Bs (configurable, default 10),
--     sin importar puntualidad. Quincenas: 28→13 y 14→27.
--  2) Personal con área de trabajo (= turno con horario propio), teléfono.
--     El atraso se calcula contra el horario del área del empleado.
--  3) Seguimiento de visitas de supervisores a sucursales.

-- ── Áreas: los turnos ganan CRUD (borrado lógico) ──
ALTER TABLE turno_catalogo ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- El schema original fijaba los nombres a MAÑANA/TARDE; con áreas el nombre es libre
-- (Cocina, Reparto, ...). El UNIQUE se mantiene.
ALTER TABLE turno_catalogo DROP CONSTRAINT IF EXISTS turno_catalogo_nombre_check;

-- ── Personal: área asignada, teléfono, flag de supervisor ──
ALTER TABLE empleado ADD COLUMN IF NOT EXISTS area_turno_id INT NULL REFERENCES turno_catalogo(id);
ALTER TABLE empleado ADD COLUMN IF NOT EXISTS telefono VARCHAR(30) NULL;
ALTER TABLE empleado ADD COLUMN IF NOT EXISTS es_supervisor BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Pago por día trabajado (Bs), editable desde el panel ──
INSERT INTO configuracion (clave, valor) VALUES ('pago_dia_bs', '10')
ON CONFLICT (clave) DO NOTHING;

-- ── Visitas de supervisores ──
CREATE TABLE IF NOT EXISTS visita_supervisor (
    id              SERIAL PRIMARY KEY,
    empleado_id     INT NOT NULL REFERENCES empleado(id),
    sucursal_id     INT NOT NULL REFERENCES sucursal(id),
    timestamp_utc   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    gps_lat         DOUBLE PRECISION NULL,
    gps_lng         DOUBLE PRECISION NULL,
    dentro_geocerca BOOLEAN NULL
);

CREATE INDEX IF NOT EXISTS ix_visita_supervisor_fecha
    ON visita_supervisor(empleado_id, sucursal_id, timestamp_utc);

-- Permisos del módulo visitas (lectura del reporte en el panel)
INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'visitas', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'visitas', TRUE, TRUE FROM roles WHERE nombre = 'admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
