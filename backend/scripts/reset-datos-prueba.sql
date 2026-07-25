-- Borra los datos de prueba/demo (sucursales, personal, dispositivos, biometría y todo
-- lo transaccional que depende de ellos) para dejar la base limpia antes del piloto real.
--
-- NO toca: usuarios/roles (login de RRHH), turno_catalogo/turno_bloque (áreas y horarios),
-- regla_descuento (tarifas), configuracion (parámetros generales), auditoria (historial).
--
-- Este script NO es una migración — no pertenece a la carpeta sql/ del proyecto ni debe
-- correr vía "npm run migrate". Es un cleanup manual, de un solo uso, para pegar en el
-- SQL Editor de Supabase.
--
-- Uso: Supabase Dashboard -> tu proyecto -> SQL Editor -> New query -> pegar todo esto -> Run.

BEGIN;

DELETE FROM descuento;
DELETE FROM dispositivo_corporativo_empleado;
DELETE FROM marcacion;
DELETE FROM visita_supervisor;
DELETE FROM novedad;
DELETE FROM enrolamiento_biometrico;
DELETE FROM dispositivo_empleado;
DELETE FROM liveness_reto;
DELETE FROM turno_jornada;
DELETE FROM qr_token;
DELETE FROM dispositivo_corporativo;
DELETE FROM empleado;
DELETE FROM sucursal;

COMMIT;

-- Verificación: todas estas filas deberían dar 0.
SELECT
  (SELECT COUNT(*) FROM descuento) AS descuento,
  (SELECT COUNT(*) FROM dispositivo_corporativo_empleado) AS dispositivo_corporativo_empleado,
  (SELECT COUNT(*) FROM marcacion) AS marcacion,
  (SELECT COUNT(*) FROM visita_supervisor) AS visita_supervisor,
  (SELECT COUNT(*) FROM novedad) AS novedad,
  (SELECT COUNT(*) FROM enrolamiento_biometrico) AS enrolamiento_biometrico,
  (SELECT COUNT(*) FROM dispositivo_empleado) AS dispositivo_empleado,
  (SELECT COUNT(*) FROM liveness_reto) AS liveness_reto,
  (SELECT COUNT(*) FROM turno_jornada) AS turno_jornada,
  (SELECT COUNT(*) FROM qr_token) AS qr_token,
  (SELECT COUNT(*) FROM dispositivo_corporativo) AS dispositivo_corporativo,
  (SELECT COUNT(*) FROM empleado) AS empleado,
  (SELECT COUNT(*) FROM sucursal) AS sucursal;
