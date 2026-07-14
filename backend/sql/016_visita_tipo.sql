-- 016_visita_tipo.sql
-- Distingue Entrada/Salida en las visitas de supervisor (antes cada escaneo era
-- un evento suelto sin relación con los demás). El tipo lo decide el servidor
-- por paridad de visitas del día para ese (empleado, sucursal) — ver
-- visitas.service.js — y se reinicia cada día calendario (decisión del cliente
-- 2026-07-11): si un día queda una Entrada sin Salida, al día siguiente el
-- conteo vuelve a arrancar en Entrada, no sigue "abierta".

ALTER TABLE visita_supervisor
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'ENTRADA'
    CHECK (tipo IN ('ENTRADA', 'SALIDA'));

-- Filas previas a este cambio no distinguían tipo; quedan como 'ENTRADA' por
-- default (dato histórico, no se puede reconstruir el par real).
