-- 012_pantalla_token.sql
-- Token de acceso para la pantalla/kiosko de sucursal. GET /api/sucursales/:id/qr
-- entrega el secreto TOTP: sin este token en el enlace, cualquiera que conociera la
-- URL podía descargar el secreto y fabricar códigos QR válidos para cualquier momento.
-- El token viaja en el enlace que RRHH copia desde el panel (?k=...).

ALTER TABLE sucursal ADD COLUMN IF NOT EXISTS pantalla_token VARCHAR(64);

UPDATE sucursal
SET pantalla_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE pantalla_token IS NULL;
