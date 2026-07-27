-- 008_lock_down_postgrest.sql
-- Supabase expone automáticamente una API REST (PostgREST) sobre el schema public para
-- los roles anon/authenticated, con grants por defecto en ALTER DEFAULT PRIVILEGES.
-- Nuestro backend conecta como `postgres` (superusuario, bypassea RLS) directo por pg,
-- no usamos esa API REST para nada — pero quedó abierta de fábrica con CRUD completo.
-- Doble candado: revocar los grants Y habilitar RLS sin políticas (deny-by-default).
-- Ninguna de las dos cosas afecta a nuestro backend (conecta como postgres, no como
-- anon/authenticated).

-- Los roles anon/authenticated los crea Supabase; en un PostgreSQL local (entorno de
-- desarrollo, agregado 2026-07-26) no existen y la migración fallaba con
-- "no existe el rol «anon»". Se chequea su existencia antes de revocar: en Supabase se
-- comporta igual que siempre, y en local solo se saltea el REVOKE (no hay PostgREST que
-- cerrar). RLS se habilita en ambos casos.
DO $$
DECLARE
    tabla TEXT;
    hay_roles_supabase BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
      INTO hay_roles_supabase;

    FOR tabla IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        IF hay_roles_supabase THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tabla);
        END IF;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    END LOOP;

    -- Evita que tablas futuras hereden los grants por defecto de Supabase.
    IF hay_roles_supabase THEN
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    END IF;
END $$;
