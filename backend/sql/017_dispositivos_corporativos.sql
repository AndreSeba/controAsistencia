-- 017_dispositivos_corporativos.sql
-- Reemplaza la propuesta "marcación por CI sin celular" (nunca implementada): Pizza Río
-- tiene un celular corporativo por sucursal (se usa para hablar con clientes/pedidos).
-- El personal sin teléfono propio, habilitado explícitamente por RRHH, marca desde ESE
-- dispositivo — con selfie/liveness/face-match reales (el celular tiene cámara), no un
-- camino sin biometría. Modelo M:N vía tabla puente: un dispositivo corporativo puede
-- tener varios empleados habilitados; un empleado puede tener su dispositivo personal
-- activo Y estar habilitado en el corporativo a la vez (decisión del cliente
-- 2026-07-15) — lo que cambia es que solo puede MARCAR desde el corporativo si RRHH lo
-- habilitó ahí explícitamente (fila activa en dispositivo_corporativo_empleado).

CREATE TABLE IF NOT EXISTS dispositivo_corporativo (
    id                       SERIAL PRIMARY KEY,
    sucursal_id              INT NOT NULL REFERENCES sucursal(id),
    nombre                   VARCHAR(150) NOT NULL,
    device_token             VARCHAR(255) NOT NULL UNIQUE,
    estado                   VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','revocado')),
    fecha_registro           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aprobado_por_rrhh        INT NOT NULL REFERENCES usuarios(id),
    -- El teléfono no se mueve de la sucursal (a diferencia de uno personal), así que la
    -- marcación se bloquea DURO si el QR escaneado es de otra sucursal (ver
    -- marcaciones.service.js) — pero el cliente pidió que siga siendo editable por si
    -- se reasigna el celular a otra sucursal. Auditado igual que la geocerca.
    sucursal_actualizada_por INT NULL REFERENCES usuarios(id),
    sucursal_actualizada_en  TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS dispositivo_corporativo_empleado (
    id                          SERIAL PRIMARY KEY,
    dispositivo_corporativo_id  INT NOT NULL REFERENCES dispositivo_corporativo(id),
    empleado_id                 INT NOT NULL REFERENCES empleado(id),
    estado                      VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','revocado')),
    habilitado_por_rrhh         INT NOT NULL REFERENCES usuarios(id),
    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un empleado no puede tener dos habilitaciones activas para el MISMO dispositivo
-- corporativo (sí puede estar habilitado en varios dispositivos corporativos distintos
-- a la vez, ej. cubre turno en otra sucursal — caso no resuelto, ver CLAUDE.md).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispositivo_corp_empleado_activo
    ON dispositivo_corporativo_empleado(dispositivo_corporativo_id, empleado_id)
    WHERE estado = 'activo';

CREATE INDEX IF NOT EXISTS ix_dispositivo_corp_empleado_empleado
    ON dispositivo_corporativo_empleado(empleado_id) WHERE estado = 'activo';

-- Supabase expone PostgREST por default para anon/authenticated en tablas nuevas — cerrar
-- igual que 008_lock_down_postgrest.sql (el backend conecta como postgres, esto no lo afecta).
ALTER TABLE dispositivo_corporativo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dispositivo_corporativo FROM anon, authenticated;
ALTER TABLE dispositivo_corporativo_empleado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dispositivo_corporativo_empleado FROM anon, authenticated;

-- Permiso de módulo panel (rrhh_admin es el único rol administrativo, ver CLAUDE.md RBAC)
INSERT INTO rol_permisos (rol_id, modulo, puede_ver, puede_editar)
SELECT id, 'dispositivos_corporativos', TRUE, TRUE FROM roles WHERE nombre = 'rrhh_admin'
ON CONFLICT (rol_id, modulo) DO NOTHING;
