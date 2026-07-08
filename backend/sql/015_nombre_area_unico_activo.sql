-- 015_nombre_area_unico_activo.sql
-- Bug: al desactivar un área (borrado lógico), su nombre seguía "ocupado" para
-- siempre por el UNIQUE constraint plano — crear una área nueva con el mismo
-- nombre (p.ej. recrear "ADMIN" tras borrarla) fallaba con un error de Postgres
-- sin manejar (23505), que llegaba al cliente como 500 "Error interno" en vez de
-- un mensaje claro. Fix: UNIQUE solo entre las áreas ACTIVAS (índice parcial).

ALTER TABLE turno_catalogo DROP CONSTRAINT IF EXISTS turno_catalogo_nombre_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_catalogo_nombre_activo
    ON turno_catalogo(nombre) WHERE activo = TRUE;
