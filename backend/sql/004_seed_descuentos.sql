-- 004_seed_descuentos.sql
-- Siembra las bandas de descuento por atraso (P7, ver CLAUDE.md) y el permiso de
-- rrhh_admin sobre el módulo "descuentos".

INSERT INTO regla_descuento (banda_min, banda_max, monto_bs, vigente_desde)
SELECT * FROM (VALUES
    (0, 5, 0::DECIMAL(10,2), DATE '2026-01-01'),      -- tolerancia
    (6, 15, 20::DECIMAL(10,2), DATE '2026-01-01'),
    (16, 30, 40::DECIMAL(10,2), DATE '2026-01-01'),
    (31, 45, 60::DECIMAL(10,2), DATE '2026-01-01'),
    (46, 60, 80::DECIMAL(10,2), DATE '2026-01-01'),
    (61, NULL, 80::DECIMAL(10,2), DATE '2026-01-01')  -- + requiere_revision (no automático), ver P9
) AS v(banda_min, banda_max, monto_bs, vigente_desde)
WHERE NOT EXISTS (
    SELECT 1 FROM regla_descuento WHERE banda_min = 0 AND vigente_desde = DATE '2026-01-01'
);

INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'descuentos', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
