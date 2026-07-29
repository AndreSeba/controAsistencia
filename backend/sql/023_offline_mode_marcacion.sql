-- 023_offline_mode_marcacion.sql
-- Agrega `totp_token` y `offline_mode` a `marcacion` — columnas del Modo Offline
-- Invencible (ver CLAUDE.md "QR dinámico (Modo Offline / TOTP)", Fase 2.5): cuando el
-- empleado marca sin red, la PWA guarda el token TOTP y un flag de "vino offline" para
-- que el backend recalcule el TOTP de ese instante exacto al sincronizar. Igual que
-- `totp_secret` de `sucursal` (022_totp_secret.sql), esta columna existe en producción
-- desde esa fase pero se agregó a mano en Supabase y nunca quedó en una migración —
-- detectado 2026-07-27 al marcar ENTRADA real en la PWA de dev: "no existe la columna
-- «offline_mode» en la relación «marcacion»". Barrido completo del resto del esquema
-- (todas las tablas, producción vs. dev) confirmó que estas son las únicas dos columnas
-- que faltaban en cualquier lado. Idempotente: no-op en producción (ya las tiene).
ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS totp_token VARCHAR(6);
ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS offline_mode BOOLEAN NOT NULL DEFAULT FALSE;
