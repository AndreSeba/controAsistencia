# API — Control de Asistencia Pizza Río

Referencia de todos los endpoints expuestos por el backend (`src/routes/*.routes.js`).
Backend server-authoritative: toda validación de negocio (identidad, geocerca, atraso,
descuentos, hora) ocurre acá — los clientes (panel RRHH, PWA) son tontos.

- **Base URL local:** `http://localhost:3001/api`
- **Base URL producción:** `https://controasistencia.onrender.com/api`
- **Formato:** JSON en request y response, salvo los endpoints de export (`.xlsx`) y el registro de
  marcación/biometría (`multipart/form-data` por el archivo de imagen).
- **Zona horaria:** todo se guarda y viaja en **UTC**. El panel muestra en UTC-4 (Bolivia, sin DST).

---

## Índice

1. [Autenticación](#1-autenticación)
2. [Convenciones generales](#2-convenciones-generales)
3. [Auth](#3-auth) — `/api/auth`
4. [Sucursales](#4-sucursales) — `/api/sucursales`
5. [Empleados](#5-empleados) — `/api/empleados`
6. [Marcaciones](#6-marcaciones) — `/api/marcaciones`
7. [Descuentos](#7-descuentos) — `/api/descuentos`
8. [Turnos (áreas y horarios)](#8-turnos-áreas-y-horarios) — `/api/turnos`
9. [Configuración](#9-configuración) — `/api/configuracion`
10. [Dashboard](#10-dashboard) — `/api/dashboard`
11. [Novedades](#11-novedades) — `/api/novedades`
12. [Visitas de supervisor](#12-visitas-de-supervisor) — `/api/visitas`

---

## 1. Autenticación

Hay **tres credenciales distintas** conviviendo en la misma API, cada una para un cliente distinto:

| Credencial | Quién la usa | Cómo viaja | Middleware |
|---|---|---|---|
| **JWT access token** | Panel RRHH (humano logueado) | Header `Authorization: Bearer <token>` | `verificarAccessToken` + `requierePermiso(modulo, accion)` |
| **Device token** | PWA del empleado/supervisor (sin login) | Header `x-device-token` | `verificarDispositivo` |
| **Pantalla token** | Kiosko/tablet física de la sucursal (sin login) | Query string `?k=<pantalla_token>` | validado a mano en el service, no hay middleware |

### JWT (panel RRHH)

- `POST /api/auth/login` devuelve un **access token** corto (`JWT_ACCESS_TTL`) en el body y setea un
  **refresh token** en una cookie `httpOnly` (`refreshToken`, `path=/api/auth`, `sameSite=lax`,
  `secure` en producción).
- El access token nunca se guarda en localStorage — vive en memoria del front. Al recargar la
  página, `POST /api/auth/refresh` usa la cookie (el navegador la manda solo) para pedir uno nuevo
  sin volver a loguearse.
- **RBAC por rol, leído de la base en cada request** (no hardcodeado en el JWT, salvo el nombre del
  rol). `requierePermiso(modulo, accion)` verifica que el rol del usuario tenga `accion` (`puede_ver`
  / `puede_editar`) habilitada para `modulo` en la tabla `rol_permisos`. Los módulos son:
  `sucursales`, `empleados`, `marcaciones`, `descuentos`, `turnos`, `configuracion`, `novedades`,
  `visitas`. (`dashboard` reusa el permiso de `marcaciones`.)
- Roles existentes: `empleado` (no usado para login humano, es conceptual) y `rrhh_admin`.

### Device token (PWA)

El empleado no tiene usuario/contraseña. Su credencial es un `device_token` opaco de 64 hex chars,
emitido por RRHH al enrolar su primer dispositivo (`POST /api/empleados/:id/dispositivo`) y guardado
en IndexedDB del navegador. Se manda en el header `x-device-token` en cada request de la PWA. El
middleware `verificarDispositivo` lo resuelve a `req.dispositivo = { id, empleadoId, deviceToken }`.

### Pantalla token (kiosko de sucursal)

`GET /api/sucursales/:id/qr` es la única ruta de todo el backend sin ningún middleware de auth — es
la pantalla física de la sucursal, que muestra el QR rotativo. Su seguridad es el
**query param `?k=<pantalla_token>`**: un secreto largo generado por sucursal, copiado desde el panel
("Copiar enlace") a la URL que se abre en la tablet. Sin el token correcto, el endpoint no revela el
secreto TOTP.

---

## 2. Convenciones generales

- **Errores:** siempre `{ "error": "mensaje" }`. Los status code son explícitos por los `Error`
  personalizados de cada service (`.status`); un error inesperado (bug, fallo de Postgres) cae al
  handler global y responde `500 { "error": "Error interno" }` — nunca expone `err.message` crudo.
- **Rate limiting:** `300 req / 15 min` por IP en todo `/api`. `POST /api/auth/login` tiene un
  límite más estricto: `10 intentos / 15 min` por IP.
- **CORS:** lista blanca explícita de orígenes (`CORS_ORIGINS`), con `credentials: true`. Requests
  sin header `Origin` (curl, Postman, server-to-server) siempre pasan.
- **IDs:** todos numéricos (`Number`), llegan como string en la URL y se castean en el controller.
- **Fechas de filtro:** formato `YYYY-MM-DD` en query params (`fechaInicio`, `fechaFin`, `fecha`).
  `periodo` para reportes mensuales es `YYYY-MM`.
- **Booleans en query string:** viajan como texto (`?incluirInactivas=true`), se comparan con
  `=== 'true'`.
- **Multipart:** los únicos endpoints con `multipart/form-data` son los que reciben una imagen
  (selfie de marcación, foto de referencia biométrica) — campo de archivo `selfie` o `foto`,
  jpeg/png/webp, máx. 5 MB (`multer`, memoria, sin tocar disco).

---

## 3. Auth

Base: `/api/auth` — sin JWT previo (son los endpoints que lo emiten).

### `POST /api/auth/login`

Rate-limited: 10/15min por IP. Bloquea el usuario 15 min tras 5 intentos fallidos seguidos.

**Body**
```json
{ "email": "rrhh@pizzario.bo", "password": "..." }
```

**200**
```json
{
  "accessToken": "eyJhbGciOi...",
  "usuario": { "id": 1, "nombre": "RRHH", "email": "rrhh@pizzario.bo", "rol": "rrhh_admin" }
}
```
Setea cookie `refreshToken` (httpOnly).

**Errores:** `400` si falta email/password · `401` credenciales inválidas · `423` usuario bloqueado
temporalmente.

### `POST /api/auth/refresh`

Sin body — usa la cookie `refreshToken`. Rota el refresh token (revoca el viejo, emite uno nuevo).

**200** — misma forma que `login`. **401** si la cookie falta, es inválida o expiró.

### `POST /api/auth/logout`

Sin body. Revoca el refresh token vigente y limpia la cookie. **204** sin contenido.

---

## 4. Sucursales

Base: `/api/sucursales` — requiere JWT + permiso de módulo `sucursales`, **excepto**
`GET /:id/qr` (pantalla física, ver [sección 1](#pantalla-token-kiosko-de-sucursal)).

### `GET /api/sucursales`
Permiso: `puede_ver`. Query opcional: `?incluirInactivas=true` (por defecto solo activas).

**200** → array de sucursales: `{ id, nombre, activo, geo_lat, geo_lng, geo_radio_m, wifi_bssid, pantalla_token, totp_secret, ... }`

### `GET /api/sucursales/:id`
Permiso: `puede_ver`. **200** → una sucursal. **404** si no existe.

### `POST /api/sucursales`
Permiso: `puede_editar`.

**Body**
```json
{ "nombre": "Sucursal Beni", "geoLat": -17.78, "geoLng": -63.18, "geoRadioM": 100, "wifiBssid": null }
```
`geoRadioM` debe estar entre 20 y 500 m. **201** → sucursal creada (incluye `pantalla_token` generado).

### `PUT /api/sucursales/:id`
Permiso: `puede_editar`. Solo datos generales (no geocerca).

**Body:** `{ "nombre": "...", "activo": true }` → **200** sucursal actualizada.

### `PUT /api/sucursales/:id/geocerca`
Permiso: `puede_editar`. Cambia ubicación/radio — **auditado** (queda registro de quién/cuándo/valor
anterior). Las marcaciones pasadas no se re-juzgan (snapshot por marcación, no versionado).

**Body:** `{ "geoLat": -17.78, "geoLng": -63.18, "geoRadioM": 100, "wifiBssid": null }` → **200**.

### `GET /api/sucursales/:id/qr?k=<pantalla_token>`
**Sin JWT.** Devuelve el secreto TOTP de la sucursal (genera uno si no existe todavía) más la hora
del servidor, para que la pantalla renderice el QR rotativo localmente (funciona offline).

**200**
```json
{ "totpSecret": "JBSWY3DPEHPK3PXP", "serverTime": 1752345600000 }
```
**401** si `k` no coincide con el `pantalla_token` de esa sucursal.

---

## 5. Empleados

Base: `/api/empleados` — JWT + permiso `empleados`, salvo `GET /yo` (device token, PWA).

### `GET /api/empleados/yo`
Auth: **device token** (`x-device-token`), no JWT. Perfil mínimo del empleado dueño del
dispositivo — la PWA lo usa para decidir si mostrar el botón "Registrar visita" (solo supervisores).

**200**
```json
{ "id": 12, "nombre": "Juan", "apellido": "Pérez", "esSupervisor": false }
```

### `GET /api/empleados`
Permiso: `puede_ver`. Query opcional: `?incluirInactivos=true`.

### `GET /api/empleados/:id`
Permiso: `puede_ver`. **404** si no existe.

### `POST /api/empleados`
Permiso: `puede_editar`.

**Body**
```json
{
  "nombre": "Juan", "apellido": "Pérez", "documentoNro": "8765432",
  "hrmsRef": null, "areaTurnoId": 3, "telefono": "70000000", "esSupervisor": false
}
```
`documentoNro` es único (409 si ya existe). **201** → empleado creado.

### `PUT /api/empleados/:id`
Permiso: `puede_editar`. Mismo body que crear + `estado` (`'activo' | 'inactivo'`). **200**.

### `POST /api/empleados/:id/dispositivo`
Permiso: `puede_editar`. Enrola el primer (y único) dispositivo del empleado — **no autoservicio**,
lo hace RRHH desde el panel. **409** si ya tiene un dispositivo activo (hay que revocarlo primero).

**201**
```json
{ "id": 5, "deviceToken": "a3f9...64 hex chars", "fechaRegistro": "2026-07-12T10:00:00.000Z" }
```
> El `deviceToken` se devuelve **una sola vez**; el cliente (PWA) lo persiste en IndexedDB.

### `GET /api/empleados/:id/dispositivo/enlace`
Permiso: `puede_ver`. Reenvía el enlace de activación sin regenerar el token (por si el empleado lo
perdió antes de configurar el celular). **404** si no tiene dispositivo activo.

**200:** `{ "deviceToken": "a3f9..." }`

### `DELETE /api/empleados/:id/dispositivo/:dispositivoId`
Permiso: `puede_editar`. Revoca el dispositivo activo (auditado). **204**. **404** si el
`dispositivoId` no coincide con el dispositivo activo de ese empleado.

### `POST /api/empleados/:id/biometria`
Permiso: `puede_editar`. `multipart/form-data`, campo **`foto`** (jpeg/png/webp, máx. 5 MB).
Genera el embedding facial (`face-api`), lo cifra (AES-256-GCM) y revoca cualquier enrolamiento
biométrico anterior del empleado.

**201**
```json
{ "id": 8, "fotoUrl": "https://.../uploads/biometria/....jpg", "fecha": "2026-07-12T10:00:00.000Z" }
```
**400** si falta el archivo.

---

## 6. Marcaciones

Base: `/api/marcaciones`. **Dos caminos de auth distintos en el mismo router**: registrar
(device token, PWA) vs. consultar/administrar (JWT, panel RRHH).

### `POST /api/marcaciones/reto-liveness`
Auth: device token. Emite un reto de un solo uso que la PWA debe "resolver" antes de marcar
(anti-replay real; el análisis de movimiento en sí es un stub — ver `CLAUDE.md`).

**200**
```json
{ "nonce": "c1b2...", "tipoReto": "PARPADEO", "expira": "2026-07-12T10:05:00.000Z" }
```
`tipoReto` ∈ `PARPADEO | GIRO_IZQUIERDA | GIRO_DERECHA | SONREIR`. TTL configurable
(`LIVENESS_RETO_TTL_SECONDS`, default 30s).

### `POST /api/marcaciones`
Auth: device token. `multipart/form-data`, campo **`selfie`** obligatorio.

**Campos del form (además de `selfie`):**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sucursalId` | number | sí | sucursal del QR escaneado |
| `qrToken` | string | sí | código TOTP de 6 dígitos leído del QR |
| `livenessNonce` | string | sí (salvo offline) | nonce emitido por `/reto-liveness` |
| `gpsLat`, `gpsLng`, `gpsPrecisionM` | number | no | señal blanda, nunca bloquea |
| `tipo` | `'ENTRADA' \| 'SALIDA'` | no | intención del cliente; el servidor manda — 409 si no coincide con el estado real de la jornada |
| `offlineMode` | boolean | no | marcación encolada por el kiosko sin internet |
| `timestampOffline` | number (ms epoch) | requerido si `offlineMode` | debe estar dentro de ±48h |

El servidor decide ENTRADA/SALIDA por el estado real de la jornada del empleado (no confía en `tipo`
del cliente), valida el TOTP contra el secreto de la sucursal, corre face-match server-side contra
el template biométrico activo, calcula geocerca/atraso/anticipación, y — si es ENTRADA con atraso —
dispara el cálculo de descuento en la misma transacción.

**201**
```json
{
  "id": 1044, "empleado_id": 12, "sucursal_id": 3, "tipo": "ENTRADA",
  "timestamp_utc": "2026-07-12T14:03:00.000Z",
  "dentro_geocerca": true, "identidad_verificada": true, "face_match_score": 0.42,
  "minutos_atraso": 3, "minutos_anticipacion": null,
  "estado": "registrada", "revisado": false, "selfie_url": "https://.../uploads/marcaciones/....jpg"
}
```
`estado` es `"registrada"` o `"requiere_revision"` (identidad no verificada, fuera de geocerca,
atraso > 60 min, anticipación excesiva, u offline — nunca bloquea la marcación en sí).

**Errores comunes:** `400` selfie faltante o campos requeridos · `401` QR (TOTP) inválido o
expirado · `409` ya hay una entrada abierta / no hay entrada para cerrar / sucursal sin QR
configurado · `422` timestamp offline fuera de rango.

### `GET /api/marcaciones`
Auth: JWT, permiso `marcaciones.puede_ver`. Query: `empleadoId`, `sucursalId`, `estado`, `tipo`,
`revisado` (`true|false`) — todos opcionales, combinables.

### `GET /api/marcaciones/export`
Mismos filtros que arriba. Devuelve un `.xlsx` (`Content-Disposition: attachment`) con columnas
Empleado, Apellido, Documento, Sucursal, Tipo, Fecha/hora UTC, Dentro geocerca, Identidad
verificada, Atraso, Anticipación, Estado, Revisado.

### `PUT /api/marcaciones/:id/revisar`
Auth: JWT, permiso `marcaciones.puede_editar`. Marca una marcación `requiere_revision` como
revisada por RRHH (auditado: quién y cuándo). **409** si no estaba en `requiere_revision` o ya
había sido revisada. **404** si no existe.

---

## 7. Descuentos

Base: `/api/descuentos` — JWT + permiso `descuentos` para todo el router.

### `GET /api/descuentos`
Permiso: `puede_ver`. Query: `periodo` (`YYYY-MM`), `fecha` (`YYYY-MM-DD`), `estado`, `empleadoId`.

### `GET /api/descuentos/reporte`
Permiso: `puede_ver`. Requiere `periodo` o `fecha`. Agrega descuentos por empleado
(`cantidad_descuentos`, `total_bs`, `total_aplicado_bs`).

### `GET /api/descuentos/reporte/export`
Mismo filtro, devuelve `.xlsx`.

### `GET /api/descuentos/planilla`
Permiso: `puede_ver`. Requiere `fechaInicio` y `fechaFin` (pensado para las quincenas fijas
28→13 / 14→27, pero acepta cualquier rango). Una fila por **(empleado, sucursal)** — un flotante que
marcó en más de una sucursal aparece una vez por cada una.

**200**
```json
{
  "pagoDiaBs": 10,
  "filas": [
    {
      "nombre": "Juan", "apellido": "Pérez", "sucursal_nombre": "Beni",
      "dias_trabajados": 14, "ganado_bs": 140, "descuentos_bs": 20, "total_bs": 120
    }
  ]
}
```
`total_bs` **puede ser negativo** si los descuentos superan lo ganado (sin piso en 0).

### `GET /api/descuentos/planilla/export`
Mismos parámetros, devuelve `.xlsx`.

### `GET /api/descuentos/reglas`
Permiso: `puede_ver`. Lista las bandas de descuento por atraso (`regla_descuento`):
`{ id, banda_min, banda_max, monto_bs, vigente_desde }`.

Tabla vigente (editable desde acá, no hardcodeada):

| Atraso (min) | Descuento |
|---|---|
| ≤ 5 | 0 Bs |
| 6–15 | 20 Bs |
| 16–30 | 40 Bs |
| 31–45 | 60 Bs |
| 46–60 | 80 Bs |
| > 60 | 80 Bs (además, la marcación queda en `requiere_revision`) |

### `PUT /api/descuentos/reglas/:id`
Permiso: `puede_editar`. **Body:** `{ "monto_bs": 25 }` (número ≥ 0). **200** regla actualizada.
**404** si no existe.

### `PUT /api/descuentos/:id/avanzar`
Permiso: `puede_editar`. Legado (P11 lo dejó de usar para descuentos nuevos, que nacen directo en
`aplicado`) — sigue existiendo para filas viejas en `calculado`/`aprobado`.
Transiciones: `calculado → aprobado → aplicado`. **409** si el estado actual no tiene siguiente paso.

---

## 8. Turnos (áreas y horarios)

Base: `/api/turnos` — JWT + permiso `turnos`. En el panel esto se llama "Áreas y horarios" (el
catálogo fijo MAÑANA/TARDE original fue reemplazado por áreas configurables).

### `GET /api/turnos`
Permiso: `puede_ver`. Lista las áreas con sus bloques horarios (`hora_inicio`/`hora_fin` en `HH:MM`).

### `POST /api/turnos`
Permiso: `puede_editar`.

**Body**
```json
{
  "nombre": "Administración",
  "bloques": [
    { "horaInicio": "08:00", "horaFin": "12:00" },
    { "horaInicio": "14:30", "horaFin": "18:30" }
  ],
  "aplicaDescuento": false
}
```
1 bloque = horario corrido, 2 bloques = horario partido (corte de mediodía). Los bloques no pueden
solaparse ni cruzar medianoche, y deben ir en orden cronológico. **201**.

### `PUT /api/turnos/:id`
Permiso: `puede_editar`. Mismo body que crear (sin `nombre`). **200**. Auditado (guarda valor
anterior y nuevo).

### `DELETE /api/turnos/:id`
Permiso: `puede_editar`. Desactiva el área (soft delete). **409** si hay empleados activos
asignados — hay que reasignarlos antes. **204**.

---

## 9. Configuración

Base: `/api/configuracion` — JWT + permiso `configuracion`. Dos parámetros globales, guardados como
pares clave/valor (`configuracion` table), no hardcodeados.

### `GET /api/configuracion`
Permiso: `puede_ver`.

**200**
```json
{ "margenAnticipacionMin": 30, "pagoDiaBs": 10 }
```

### `PUT /api/configuracion`
Permiso: `puede_editar`. Body con **cualquiera de los dos** campos (ambos opcionales,
independientes):

```json
{ "margenAnticipacionMin": 30, "pagoDiaBs": 10 }
```
`margenAnticipacionMin`: entero entre 0 y 240 (llegar antes de este margen respecto al turno
dispara `requiere_revision`, nunca bloquea). `pagoDiaBs`: número ≥ 0 (pago fijo por día trabajado,
usado en la planilla quincenal). Ambos auditados. **200** devuelve solo los campos que se
actualizaron.

---

## 10. Dashboard

Base: `/api/dashboard` — JWT, reusa el permiso `marcaciones.puede_ver` (es una vista agregada de lo
mismo, no un módulo de permisos propio).

### `GET /api/dashboard/resumen?periodo=hoy`
`periodo` ∈ `hoy | semana | mes | historico` (default `hoy`). Resumen de entradas/salidas/jornadas
abiertas por área + descuentos recaudados por sucursal, para ese rango.

**200 (forma resumida)**
```json
{
  "periodo": "hoy", "rango": "2026-07-12",
  "turnos": [{ "id": 3, "nombre": "Administración", "entradas": 6, "abiertas": 1, "salidas": 5, "requierenRevision": 0 }],
  "totalEntradas": 6, "totalRequierenRevision": 0,
  "descuentosPorSucursal": [{ "sucursalId": 1, "sucursalNombre": "Beni", "totalBs": 40 }],
  "totalDescuentosGenerales": 40
}
```

### `GET /api/dashboard/ranking?periodo=hoy`
Mismos períodos. Ranking de sucursales y empleados por puntualidad/atrasos, sin recortar (el panel
pagina del lado del cliente).

**200 (forma)**
```json
{
  "sucursalesMasPuntuales": [{ "sucursal_id": 1, "sucursal_nombre": "Beni", "a_tiempo": 20, "atrasos": 2 }],
  "sucursalesMasAtrasos": [ /* mismo shape, otro orden */ ],
  "empleadosMasPuntuales": [{ "empleado_id": 12, "nombre": "Juan", "apellido": "Pérez", "a_tiempo": 14, "atrasos": 0 }],
  "empleadosMasAtrasos": [ /* mismo shape, otro orden */ ]
}
```

### `GET /api/dashboard/asistencia`
Requiere `fechaInicio` y `fechaFin` (`YYYY-MM-DD`). Opcionales: `sucursalId`, `turnoId`,
`empleadoId`. Calendario de jornadas del rango, empleado por empleado, día por día — lo que arma la
vista de calendario de asistencia del panel.

**200 (forma)**
```json
{
  "fechaInicio": "2026-07-01", "fechaFin": "2026-07-12",
  "dias": ["2026-07-01", "2026-07-02", "..."],
  "jornadas": [
    {
      "empleadoId": 12, "empleadoNombre": "Juan", "empleadoApellido": "Pérez",
      "fecha": "2026-07-01", "turnoNombre": "Administración", "sucursalNombre": "Beni",
      "jornadaEstado": "CERRADO", "requiereRevision": false, "cierreAutomatico": false,
      "salidaMarcada": true, "horaEntrada": "08:03", "horaSalida": "12:01",
      "minutosAtraso": 3, "minutosAnticipacion": null, "identidadVerificada": true
    }
  ]
}
```

---

## 11. Novedades

Base: `/api/novedades` — JWT + permiso `novedades`. Cubre días libres justificados (baja médica,
permiso) que sobrescriben la falta en el calendario del panel — es 100% *write-back* de RRHH, no
tiene flujo de solicitud/aprobación (a diferencia de vacaciones, que todavía no existe).

### `GET /api/novedades`
Permiso: `puede_ver`. Requiere `fechaInicio` y `fechaFin`. Opcional: `empleadoId`.

### `POST /api/novedades`
Permiso: `puede_editar`. Upsert por `(empleadoId, fecha)`.

**Body**
```json
{ "empleadoId": 12, "fecha": "2026-07-15", "tipo": "baja_medica", "nota": "Certificado adjunto en WhatsApp" }
```
`tipo` ∈ `baja_medica | permiso`. **201**.

### `DELETE /api/novedades/:empleadoId/:fecha`
Permiso: `puede_editar`. `fecha` en la URL, formato `YYYY-MM-DD`. **204**.

---

## 12. Visitas de supervisor

Base: `/api/visitas`. Registrar usa device token (PWA); consultar usa JWT.

### `POST /api/visitas`
Auth: device token. Solo funciona si el empleado dueño del dispositivo tiene `es_supervisor = true`
(**403** si no). Reusa el QR TOTP de la sucursal — **sin selfie ni liveness**, es conteo de
presencia gerencial, no control de identidad. El servidor decide ENTRADA/SALIDA por paridad de
visitas del día para ese (empleado, sucursal); se reinicia cada día calendario.

**Body:** `{ "sucursalId": 3, "qrToken": "482913", "gpsLat": -17.78, "gpsLng": -63.18 }`

**201**
```json
{ "id": 88, "timestamp": "2026-07-12T09:00:00.000Z", "tipo": "ENTRADA", "sucursal": "Beni", "dentroGeocerca": true }
```

### `GET /api/visitas/resumen`
Auth: JWT, permiso `visitas.puede_ver`. Requiere `fechaInicio`/`fechaFin`. Conteo y última visita
por supervisor y sucursal.

### `GET /api/visitas`
Auth: JWT, permiso `visitas.puede_ver`. Requiere `fechaInicio`/`fechaFin`. Devuelve las visitas
**emparejadas** en Entrada/Salida (no fila por fila suelta) con duración calculada.

**200 (forma)**
```json
[
  {
    "empleado_id": 5, "nombre": "Carlos", "apellido": "Gómez",
    "sucursal_id": 3, "sucursal_nombre": "Beni", "fecha_local": "2026-07-12",
    "entrada_timestamp": "2026-07-12T09:00:00.000Z", "entrada_dentro_geocerca": true,
    "salida_timestamp": "2026-07-12T09:40:00.000Z", "salida_dentro_geocerca": true,
    "duracion_min": 40
  }
]
```
Una entrada sin su salida correspondiente sale igual, con `salida_timestamp: null` (en vez de
perderse).

---

## Endpoint de salud

`GET /api/health` — sin auth, sin `apiLimiter` de negocio (pero sí bajo el rate limit global).
`{ "ok": true }`. Usado por Render para health checks.
