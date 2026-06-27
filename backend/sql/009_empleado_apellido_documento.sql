-- 009_empleado_apellido_documento.sql
-- Agrega apellido y documento_nro (CI) a empleado para diferenciar personas con el
-- mismo nombre — directamente mitiga el problema de identidades duplicadas que tiene
-- el competidor (ver memoria de negocio). documento_nro es UNIQUE: impide registrar
-- dos veces a la misma persona física por error.

ALTER TABLE empleado ADD COLUMN IF NOT EXISTS apellido VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE empleado ALTER COLUMN apellido DROP DEFAULT;

ALTER TABLE empleado ADD COLUMN IF NOT EXISTS documento_nro VARCHAR(20) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_empleado_documento_nro'
    ) THEN
        ALTER TABLE empleado ADD CONSTRAINT uq_empleado_documento_nro UNIQUE (documento_nro);
    END IF;
END $$;
