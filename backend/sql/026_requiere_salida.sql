-- 026_requiere_salida.sql
-- Propuesta 2026-07-30: el cliente pidió que las sucursales marquen SOLO Entrada —
-- Salida queda exclusiva de las áreas que la necesiten (ej. Administración). Mismo
-- patrón que aplica_descuento/aplica_pago_diario: toggle por área, default TRUE (no
-- cambia nada para las áreas existentes hasta que RRHH lo desmarque a mano).
ALTER TABLE turno_catalogo
    ADD COLUMN IF NOT EXISTS requiere_salida BOOLEAN NOT NULL DEFAULT TRUE;
