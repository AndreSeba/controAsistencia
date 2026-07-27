-- 020_configuracion_valor_texto.sql
-- `configuracion.valor` nació como VARCHAR(50) (006_configuracion.sql) cuando las únicas
-- claves eran numéricas y cortas: margen_anticipacion_min ('30') y pago_dia_bs ('10').
--
-- El logo de la empresa (2026-07-26) guarda ahí la URL pública de Supabase Storage, que
-- ronda los 120 caracteres — no entraba, y Postgres devolvía un 22001 ("value too long")
-- que salía al panel como "Error interno" genérico. Se pasa a TEXT: esta tabla es
-- clave/valor genérica y no hay razón para limitar el largo de un valor arbitrario.

ALTER TABLE configuracion
    ALTER COLUMN valor TYPE TEXT;
