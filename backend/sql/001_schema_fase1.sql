-- 001_schema_fase1.sql
-- Schema completo de Fase 1 (presencia + identidad) + RBAC. Postgres/Supabase.
-- Idempotente: correr con `npm run migrate` (no requiere un rol con privilegios
-- especiales más allá de CREATE en el schema public, a diferencia de SQL Server).

-- ============================================================
-- RBAC
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL UNIQUE,   -- 'empleado' | 'rrhh_admin'
    descripcion VARCHAR(200) NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
    id                SERIAL PRIMARY KEY,
    nombre            VARCHAR(150) NOT NULL,
    email             VARCHAR(150) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    rol_id            INT NOT NULL REFERENCES roles(id),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta   TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS rol_permisos (
    id            SERIAL PRIMARY KEY,
    rol_id        INT NOT NULL REFERENCES roles(id),
    modulo        VARCHAR(100) NOT NULL,
    puede_ver     BOOLEAN NOT NULL DEFAULT FALSE,
    puede_editar  BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_rol_permisos UNIQUE (rol_id, modulo)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT NOT NULL REFERENCES usuarios(id),
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revocado    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT NULL REFERENCES usuarios(id),
    accion      VARCHAR(100) NOT NULL,
    tabla       VARCHAR(100) NULL,
    registro_id VARCHAR(50) NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip          VARCHAR(64) NULL
);

-- ============================================================
-- Sucursales (geocerca editable por RRHH, overwrite + auditoría)
-- ============================================================

CREATE TABLE IF NOT EXISTS sucursal (
    id                   SERIAL PRIMARY KEY,
    nombre               VARCHAR(150) NOT NULL,
    geo_lat              DECIMAL(9,6) NOT NULL,
    geo_lng              DECIMAL(9,6) NOT NULL,
    geo_radio_m          INT NOT NULL CHECK (geo_radio_m BETWEEN 20 AND 500),
    wifi_bssid           VARCHAR(50) NULL,
    geo_actualizado_por  INT NULL REFERENCES usuarios(id),
    geo_actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activo               BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- Empleados, dispositivo (P4), biometría
-- ============================================================

CREATE TABLE IF NOT EXISTS empleado (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    estado      VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
    hrms_ref    VARCHAR(50) NULL,           -- link opcional a HRMS externo
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispositivo_empleado (
    id                  SERIAL PRIMARY KEY,
    empleado_id         INT NOT NULL REFERENCES empleado(id),
    device_token        VARCHAR(255) NOT NULL UNIQUE,
    estado              VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','revocado')),
    fecha_registro      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aprobado_por_rrhh   INT NOT NULL REFERENCES usuarios(id)
);

-- Un solo dispositivo activo por empleado (P4)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispositivo_empleado_activo
    ON dispositivo_empleado(empleado_id)
    WHERE estado = 'activo';

CREATE TABLE IF NOT EXISTS enrolamiento_biometrico (
    id                      SERIAL PRIMARY KEY,
    empleado_id             INT NOT NULL REFERENCES empleado(id),
    face_template_cifrado   BYTEA NOT NULL,
    foto_referencia_url     VARCHAR(500) NOT NULL,
    enrolado_por            INT NOT NULL REFERENCES usuarios(id),
    fecha                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado                  VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','revocado'))
);

-- ============================================================
-- Turnos y jornadas (catálogo fijo, atribución automática)
-- ============================================================

CREATE TABLE IF NOT EXISTS turno_catalogo (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(20) NOT NULL UNIQUE CHECK (nombre IN ('MAÑANA','TARDE')),
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS turno_jornada (
    id                  SERIAL PRIMARY KEY,
    empleado_id         INT NOT NULL REFERENCES empleado(id),
    sucursal_id         INT NOT NULL REFERENCES sucursal(id),
    fecha               DATE NOT NULL,
    turno_catalogo_id   INT NOT NULL REFERENCES turno_catalogo(id),
    estado              VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO','CERRADO')),
    cierre_automatico   BOOLEAN NOT NULL DEFAULT FALSE,
    salida_marcada      BOOLEAN NOT NULL DEFAULT FALSE,
    requiere_revision   BOOLEAN NOT NULL DEFAULT FALSE
);

-- No abrir una jornada con otra ABIERTA del mismo empleado
CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_jornada_abierta_por_empleado
    ON turno_jornada(empleado_id)
    WHERE estado = 'ABIERTO';

-- ============================================================
-- QR dinámico + liveness
-- ============================================================

CREATE TABLE IF NOT EXISTS qr_token (
    id            SERIAL PRIMARY KEY,
    sucursal_id   INT NOT NULL REFERENCES sucursal(id),
    token         VARCHAR(255) NOT NULL UNIQUE,
    valido_desde  TIMESTAMPTZ NOT NULL,
    valido_hasta  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS liveness_reto (
    id            SERIAL PRIMARY KEY,
    empleado_id   INT NOT NULL REFERENCES empleado(id),
    nonce         VARCHAR(255) NOT NULL UNIQUE,
    tipo_reto     VARCHAR(50) NOT NULL,
    emitido       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira        TIMESTAMPTZ NOT NULL,
    usado         BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- Marcación (transacción server-side única)
-- ============================================================

CREATE TABLE IF NOT EXISTS marcacion (
    id                          SERIAL PRIMARY KEY,
    empleado_id                 INT NOT NULL REFERENCES empleado(id),
    turno_jornada_id            INT NOT NULL REFERENCES turno_jornada(id),
    sucursal_id                 INT NOT NULL REFERENCES sucursal(id),
    device_token                VARCHAR(255) NOT NULL,
    tipo                        VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
    timestamp_utc               TIMESTAMPTZ NOT NULL,         -- hora del servidor, nunca del cliente
    gps_lat                     DECIMAL(9,6) NULL,
    gps_lng                     DECIMAL(9,6) NULL,
    gps_precision_m             DECIMAL(7,2) NULL,
    dentro_geocerca             BOOLEAN NULL,
    geo_centro_lat_aplicado     DECIMAL(9,6) NOT NULL,        -- snapshot: no re-juzgar marcaciones pasadas
    geo_centro_lng_aplicado     DECIMAL(9,6) NOT NULL,
    geo_radio_aplicado          INT NOT NULL,
    qr_token_id                 INT NOT NULL REFERENCES qr_token(id),
    selfie_url                  VARCHAR(500) NOT NULL,
    liveness_ok                 BOOLEAN NOT NULL,
    liveness_reto_id            INT NOT NULL REFERENCES liveness_reto(id),
    face_match_score            DECIMAL(5,4) NULL,
    identidad_verificada        BOOLEAN NOT NULL,
    minutos_atraso              INT NULL,                     -- solo en ENTRADA, floor(), >0
    estado                      VARCHAR(20) NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada','requiere_revision'))
);

CREATE INDEX IF NOT EXISTS ix_marcacion_empleado_fecha ON marcacion(empleado_id, timestamp_utc);

-- ============================================================
-- Descuentos (Fase 2, schema preparado desde Fase 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS regla_descuento (
    id              SERIAL PRIMARY KEY,
    banda_min       INT NOT NULL,
    banda_max       INT NULL,                -- NULL = sin tope superior (> 60)
    monto_bs        DECIMAL(10,2) NOT NULL,
    vigente_desde   DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS descuento (
    id              SERIAL PRIMARY KEY,
    marcacion_id    INT NOT NULL REFERENCES marcacion(id),
    empleado_id     INT NOT NULL REFERENCES empleado(id),
    monto_bs        DECIMAL(10,2) NOT NULL,
    regla_id        INT NOT NULL REFERENCES regla_descuento(id),
    periodo         VARCHAR(7) NOT NULL,     -- 'YYYY-MM'
    estado          VARCHAR(20) NOT NULL DEFAULT 'calculado' CHECK (estado IN ('calculado','aprobado','aplicado')),
    aprobado_por    INT NULL REFERENCES usuarios(id)
);

-- ============================================================
-- Seeds: roles + catálogo de turnos fijo
-- ============================================================

INSERT INTO roles (nombre, descripcion) VALUES
    ('empleado', 'Marca entrada/salida desde la PWA'),
    ('rrhh_admin', 'Único rol administrativo: enrolamiento, geocerca, revisión, descuentos')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO turno_catalogo (nombre, hora_inicio, hora_fin) VALUES
    ('MAÑANA', '11:00', '15:00'),
    ('TARDE', '15:00', '23:00')
ON CONFLICT (nombre) DO NOTHING;
