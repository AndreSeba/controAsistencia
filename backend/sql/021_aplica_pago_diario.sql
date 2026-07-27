-- 021_aplica_pago_diario.sql
-- Hasta ahora, cualquier día trabajado pagaba el monto fijo (pago_dia_bs) sin importar
-- el área — correcto para el personal de sucursal, pero Administración no cobra por
-- este mecanismo (tiene sueldo aparte). Se agrega un toggle por área, mismo patrón que
-- `aplica_descuento`: por defecto TRUE (no cambia el comportamiento de las áreas
-- existentes salvo que RRHH lo desmarque a mano para Administración).

ALTER TABLE turno_catalogo
    ADD COLUMN IF NOT EXISTS aplica_pago_diario BOOLEAN NOT NULL DEFAULT TRUE;
