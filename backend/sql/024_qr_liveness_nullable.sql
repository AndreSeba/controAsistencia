-- 024_qr_liveness_nullable.sql
-- Relaja `marcacion.qr_token_id` y `marcacion.liveness_reto_id` a NULLABLE. Mismo patrón
-- que 022/023: producción ya las tiene así (coincide con el modelo documentado en
-- CLAUDE.md, ambas marcadas "(NULLABLE)"), pero el cambio se hizo a mano en Supabase en
-- su momento y nunca quedó en una migración. `001_schema_fase1.sql` las declaró NOT NULL
-- en la Fase 1, cuando cada marcación exigía un qr_token de un solo uso — con el cambio a
-- QR dinámico vía TOTP (`qr_token` quedó obsoleta, nadie la puebla) ya no hay un
-- qr_token_id real que guardar, así que exigir NOT NULL bloquea cualquier INSERT nuevo.
-- Detectado 2026-07-27 al simular una marcación real de punta a punta contra dev:
-- "el valor nulo en la columna «qr_token_id» viola la restricción de no nulo". Idempotente:
-- no-op en producción (ya son nullable ahí).
ALTER TABLE marcacion ALTER COLUMN qr_token_id DROP NOT NULL;
ALTER TABLE marcacion ALTER COLUMN liveness_reto_id DROP NOT NULL;
