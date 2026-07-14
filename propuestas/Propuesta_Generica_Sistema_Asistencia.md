# Propuesta: Sistema de Control de Asistencia con Verificación de Identidad

## Resumen ejecutivo

Sistema de marcado de asistencia diseñado para empresas con múltiples sucursales o
puntos de trabajo, donde el personal marca entrada y salida desde su propio teléfono
mediante una aplicación web (PWA), sin necesidad de hardware dedicado ni instalación
desde una tienda de aplicaciones.

El sistema resuelve tres problemas típicos del control de asistencia tradicional:
- **Suplantación de identidad** ("buddy punching"): un empleado marca por otro.
- **Marcación fuera del lugar de trabajo.**
- **Carga administrativa de horarios**: no requiere planillas ni rosters previos por
  persona — el sistema atribuye automáticamente el turno correspondiente en el momento
  de marcar.

Toda decisión sensible (verificación de identidad, cálculo de atraso, validez del
código QR, hora de marcación) se valida en el servidor, nunca en el teléfono del
empleado — esto evita que la app pueda ser manipulada para falsear una marcación.

---

## Cómo funciona

1. **Código QR dinámico en cada sucursal.** Una pantalla o tablet en el punto de
   trabajo muestra un código QR que rota automáticamente (mismo principio que un
   token de autenticación de un solo uso). Un QR estático sería fácil de fotografiar
   y reutilizar desde cualquier lugar; el QR dinámico exige presencia física real en
   el momento de escanear.
2. **El empleado escanea el QR con su teléfono** y toma una selfie en vivo (nunca
   una foto de galería) para verificar su identidad contra una foto de referencia
   registrada al momento de su alta.
3. **Verificación en el servidor:** reconocimiento facial + validación de que el QR
   sigue vigente + confirmación de que es un dispositivo previamente autorizado para
   ese empleado. Todo en una sola operación atómica.
4. **Atribución automática de turno y cálculo de atraso**, sin que RRHH tenga que
   cargar un horario previo por persona — cada área o puesto de trabajo tiene su
   propio horario configurado una sola vez.
5. **Ubicación (GPS) como señal complementaria, no como bloqueo.** El GPS en un
   teléfono es fácil de falsear y pierde precisión en interiores, por lo que nunca
   se usa como único filtro: una marcación fuera de rango queda señalada para
   revisión humana, pero no se rechaza automáticamente.
6. **Modo offline:** si la sucursal se queda sin internet, el QR se sigue generando
   localmente y las marcaciones de los empleados se guardan en el teléfono y se
   sincronizan solas al recuperar conexión — la operación no se detiene.

---

## Principio de diseño: nunca bloquear, siempre auditar

Ninguna señal débil (GPS, timing, fallo de reconocimiento facial) bloquea al
empleado en el momento. Cualquier anomalía queda registrada y visible en una cola de
revisión para el equipo administrativo, que decide después con criterio humano. Esto
evita que un problema técnico puntual (mala señal GPS, luz insuficiente para la
cámara, teléfono nuevo sin aprobar aún) le impida a alguien marcar su entrada y, por
lo tanto, perder parte de su jornada o su pago.

---

## Módulos incluidos

### Marcación de asistencia
- Entrada/salida vía QR + selfie + verificación de identidad.
- Cálculo automático de minutos de atraso y de anticipación excesiva, ambos como
  señal configurable, no como bloqueo.
- Cierre automático de jornadas olvidadas (sin inventar una hora de salida ficticia:
  queda marcada como "salida no registrada" para que el equipo administrativo la
  revise).

### Panel administrativo
- Vista de todas las marcaciones, con filtros por sucursal, persona y estado.
- Cola de revisión de casos atípicos (identidad no verificada, atraso alto, GPS
  fuera de rango, mismo dispositivo usado por más de una persona).
- Gestión de sucursales/puntos de trabajo: ubicación y radio de geocerca editables,
  con auditoría de cada cambio.
- Gestión de personal: alta, edición, áreas/horarios, aprobación del primer
  dispositivo de cada persona.
- Exportes a Excel de marcaciones y reportes.
- Panel visual con resumen del día y estadísticas por período.

### Áreas y horarios flexibles
- Cada área o puesto define su propio horario (turno corrido o partido, con corte
  de mediodía), sin depender de un catálogo fijo de turnos.
- El atraso se calcula siempre contra el bloque horario más cercano a la hora real
  de llegada.

### Descuentos / incentivos por puntualidad (opcional, configurable)
- Reglas de descuento por bandas de atraso, editables desde el panel sin tocar
  código ni base de datos.
- Posibilidad de excluir ciertas áreas del descuento automático (por ejemplo, personal
  administrativo vs. personal operativo).

### Pago por día trabajado (opcional, configurable)
- Cálculo de un monto fijo por día trabajado, agrupado por período de pago definido
  por la empresa (quincenal, mensual, u otro), con reporte exportable.

### Registro de visitas de supervisión (opcional)
- Permite llevar un conteo de visitas de personal de supervisión a cada punto de
  trabajo, reutilizando el mismo mecanismo de QR, sin necesidad de un módulo aparte.

### Gestión de licencias / vacaciones (en roadmap)
- Cálculo de saldo disponible según antigüedad, solicitud desde la app del empleado,
  aprobación desde el panel administrativo, e integración automática con el
  calendario de asistencia y con el pago por día trabajado.

---

## Seguridad y confiabilidad

- Verificación de identidad y de reglas de negocio 100% del lado del servidor — la
  app del teléfono nunca decide nada por sí sola.
- Contraseñas y tokens de sesión manejados con estándares de la industria (hash con
  costo configurable, tokens de corta duración con renovación segura).
- Cifrado de las plantillas biométricas en reposo.
- Registro de auditoría inmutable de cada marcación, cambio de ubicación de
  sucursal, y ajuste de descuento.
- Protección contra los errores más comunes de aplicaciones web (inyección SQL,
  configuración insegura de acceso entre dominios, doble envío accidental de
  formularios).
- Diseño pensado para escalar a app nativa a futuro sin rehacer la lógica de
  verificación, que ya vive enteramente en el servidor.

---

## Por qué este enfoque

| Problema típico | Cómo lo resuelve el sistema |
|---|---|
| Alguien marca por otro compañero | Selfie en vivo + verificación facial + dispositivo autorizado por persona |
| Marcaciones remotas o falsificadas | QR dinámico que exige presencia física real en el momento de escanear |
| Carga administrativa de horarios | Atribución automática de turno por área, sin roster previo |
| Falsos rechazos por GPS/cámara | Señales débiles nunca bloquean, solo generan revisión |
| Falta de trazabilidad | Auditoría completa de marcaciones, cambios y descuentos |
| Cortes de conectividad en sucursales | Modo offline con sincronización automática |

---

## Flexibilidad

El sistema está diseñado para adaptarse a distintos rubros y tamaños de operación:
cantidad de sucursales, moneda y montos de descuento/pago, normativa laboral local
aplicable a licencias y vacaciones, y horarios por área son todos parámetros
configurables, no decisiones fijas en el código.
