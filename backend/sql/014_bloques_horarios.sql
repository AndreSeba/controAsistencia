-- 014_bloques_horarios.sql
-- Soporte para horarios discontinuos (bloques) y descuentos configurables por área.
--
-- Ejemplo: Administración tiene 2 bloques (08:00–12:00 y 14:30–18:30) con
-- descuentos desactivados. Sucursales tienen 1 bloque con descuentos activados.

-- ── 1. Flag de descuento por área ──
ALTER TABLE turno_catalogo ADD COLUMN IF NOT EXISTS aplica_descuento BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. Tabla de bloques horarios ──
CREATE TABLE IF NOT EXISTS turno_bloque (
    id                SERIAL PRIMARY KEY,
    turno_catalogo_id INT NOT NULL REFERENCES turno_catalogo(id) ON DELETE CASCADE,
    numero_bloque     SMALLINT NOT NULL CHECK (numero_bloque >= 1),
    hora_inicio       TIME NOT NULL,
    hora_fin          TIME NOT NULL,
    CONSTRAINT uq_bloque_por_turno UNIQUE (turno_catalogo_id, numero_bloque),
    CONSTRAINT ck_bloque_horario CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS ix_turno_bloque_catalogo ON turno_bloque(turno_catalogo_id);

-- ── 3. Migrar datos existentes al bloque 1 ──
-- Solo migra áreas que todavía no tienen bloques (idempotente).
INSERT INTO turno_bloque (turno_catalogo_id, numero_bloque, hora_inicio, hora_fin)
SELECT id, 1, hora_inicio, hora_fin
FROM turno_catalogo
WHERE id NOT IN (SELECT DISTINCT turno_catalogo_id FROM turno_bloque);
