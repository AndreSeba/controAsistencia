-- 018_activacion_dispositivo_un_solo_uso.sql
-- El enlace de activación del dispositivo personal (P4) llevaba el device_token
-- permanente en texto plano en la URL (?token=...) — si el empleado reenviaba el
-- link (antes de abrirlo él) a otra persona, esa persona quedaba con el mismo
-- acceso permanente, sin forma de revertirlo salvo revocar y re-enrolar.
--
-- Se separa el secreto permanente (device_token, nunca vuelve a viajar en un link
-- después del enrolamiento inicial) de un código de activación de un solo uso
-- (activacion_token): es lo único que viaja en el link que copia RRHH. La PWA lo
-- canjea una vez por el device_token real (POST /empleados/activar-dispositivo) y
-- el código queda inutilizado — un segundo click en el mismo link ya no sirve.
-- "Copiar enlace" (RRHH reenviando el link) genera un código nuevo cada vez,
-- invalidando cualquier copia anterior sin usar.

ALTER TABLE dispositivo_empleado
    ADD COLUMN IF NOT EXISTS activacion_token VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS activacion_usado_en TIMESTAMPTZ NULL;
