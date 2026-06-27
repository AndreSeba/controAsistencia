-- 008_lock_down_postgrest.sql
-- Supabase expone automáticamente una API REST (PostgREST) sobre el schema public para
-- los roles anon/authenticated, con grants por defecto en ALTER DEFAULT PRIVILEGES.
-- Nuestro backend conecta como `postgres` (superusuario, bypassea RLS) directo por pg,
-- no usamos esa API REST para nada — pero quedó abierta de fábrica con CRUD completo.
-- Doble candado: revocar los grants Y habilitar RLS sin políticas (deny-by-default).
-- Ninguna de las dos cosas afecta a nuestro backend (conecta como postgres, no como
-- anon/authenticated).

DO $$
DECLARE
    tabla TEXT;
BEGIN
    FOR tabla IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tabla);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    END LOOP;
END $$;

-- Evita que tablas futuras hereden los grants por defecto de Supabase para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
