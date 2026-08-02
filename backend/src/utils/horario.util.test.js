const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  minutosDelDiaLocal,
  fechaLocal,
  diaSemanaLocal,
  atribuirTurno,
  atribuirBloque,
  calcularMinutosAtraso,
  calcularMinutosAnticipacion,
  bloquePendienteTrasSalida,
} = require('./horario.util');

const CATALOGO = [
  { id: 1, nombre: 'MAÑANA', hora_inicio: '11:00:00', hora_fin: '15:00:00' },
  { id: 2, nombre: 'TARDE', hora_inicio: '15:00:00', hora_fin: '23:00:00' },
];

test('minutosDelDiaLocal convierte UTC a Bolivia (UTC-4)', () => {
  assert.equal(minutosDelDiaLocal(new Date('2026-06-20T15:00:00Z')), 11 * 60);
  assert.equal(minutosDelDiaLocal(new Date('2026-06-20T00:00:00Z')), 20 * 60); // cruza al día anterior
});

test('fechaLocal usa la fecha calendario de Bolivia, no la de UTC', () => {
  assert.equal(fechaLocal(new Date('2026-06-20T02:00:00Z')), '2026-06-19');
  assert.equal(fechaLocal(new Date('2026-06-20T05:00:00Z')), '2026-06-20');
});

test('atribuirTurno asigna al turno con hora_inicio más cercana', () => {
  // 11:40 local -> más cerca de MAÑANA (11:00) que de TARDE (15:00)
  assert.equal(atribuirTurno(new Date('2026-06-20T15:40:00Z'), CATALOGO).nombre, 'MAÑANA');
  // 15:05 local -> más cerca de TARDE
  assert.equal(atribuirTurno(new Date('2026-06-20T19:05:00Z'), CATALOGO).nombre, 'TARDE');
});

test('atribuirTurno usa distancia circular (cruce de medianoche)', () => {
  // 23:50 local está más cerca de MAÑANA (11:00, distancia 12:50hs circular) que de
  // TARDE (23:00, distancia 0:50hs) -- TARDE debe ganar por estar a solo 50 min.
  const turno = atribuirTurno(new Date('2026-06-21T03:50:00Z'), CATALOGO);
  assert.equal(turno.nombre, 'TARDE');
});

test('calcularMinutosAtraso solo cuenta si llegó después del inicio', () => {
  const turno = CATALOGO[0]; // MAÑANA 11:00
  assert.equal(calcularMinutosAtraso(new Date('2026-06-20T15:20:00Z'), turno), 20); // 11:20 local
  assert.equal(calcularMinutosAtraso(new Date('2026-06-20T14:50:00Z'), turno), null); // 10:50 local, llegó antes
  assert.equal(calcularMinutosAtraso(new Date('2026-06-20T15:00:00Z'), turno), null); // exacto a tiempo, no > 0
});

test('calcularMinutosAnticipacion solo cuenta si llegó antes del inicio', () => {
  const turno = CATALOGO[0]; // MAÑANA 11:00
  assert.equal(calcularMinutosAnticipacion(new Date('2026-06-20T14:00:00Z'), turno), 60); // 10:00 local, 1h antes
  assert.equal(calcularMinutosAnticipacion(new Date('2026-06-20T14:45:00Z'), turno), 15); // 10:45 local, 15min antes
  assert.equal(calcularMinutosAnticipacion(new Date('2026-06-20T15:20:00Z'), turno), null); // llegó después
  assert.equal(calcularMinutosAnticipacion(new Date('2026-06-20T15:00:00Z'), turno), null); // exacto a tiempo, no > 0
});

// ── bloquePendienteTrasSalida: aviso de segundo turno en horario partido ──────────────
// Caso real: Administración 08:00-12:00 / 14:30-18:30 (horas locales de Bolivia, UTC-4).
const BLOQUES_PARTIDO = [
  { numero_bloque: 1, hora_inicio: '08:00:00', hora_fin: '12:00:00' },
  { numero_bloque: 2, hora_inicio: '14:30:00', hora_fin: '18:30:00' },
];
const BLOQUES_CORRIDO = [{ numero_bloque: 1, hora_inicio: '15:00:00', hora_fin: '23:00:00' }];

test('bloquePendienteTrasSalida avisa cuando la salida del mediodía deja el 2do bloque sin marcar', () => {
  // 11:50 local: el empleado sale a almorzar, todavía le falta volver 14:30.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T15:50:00Z'), BLOQUES_PARTIDO), '14:30:00');
  // 12:00 local, la salida "de manual" del primer bloque.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T16:00:00Z'), BLOQUES_PARTIDO), '14:30:00');
  // 14:29 local: un minuto antes de que arranque el 2do bloque, sigue pendiente.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T18:29:00Z'), BLOQUES_PARTIDO), '14:30:00');
});

test('bloquePendienteTrasSalida NO avisa una vez arrancado el segundo bloque', () => {
  // 14:30 local exacto: el 2do bloque ya empezó, esta salida es de ese bloque. Límite
  // determinista a propósito (< y no <=): a la hora en punto ya no queda nada pendiente.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T18:30:00Z'), BLOQUES_PARTIDO), null);
  // 18:30 local, salida del final de la jornada: no hay tercer bloque.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T22:30:00Z'), BLOQUES_PARTIDO), null);
});

test('bloquePendienteTrasSalida no avisa nunca en un área de horario corrido', () => {
  // El personal de sucursal (1 solo bloque) no debe ver el aviso a ninguna hora.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T15:50:00Z'), BLOQUES_CORRIDO), null);
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T22:30:00Z'), BLOQUES_CORRIDO), null);
});

test('bloquePendienteTrasSalida tolera bloques ausentes sin romper', () => {
  // El empleado puede no tener área asignada (fallback del catálogo) o el área quedar
  // sin bloques: es un aviso opcional, nunca puede tumbar una marcación.
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T15:50:00Z'), undefined), null);
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T15:50:00Z'), null), null);
  assert.equal(bloquePendienteTrasSalida(new Date('2026-06-20T15:50:00Z'), []), null);
});

test('bloquePendienteTrasSalida NO reusa atribuirBloque (que elegiría el bloque equivocado)', () => {
  // Prueba de regresión del bug encontrado al implementarlo: atribuirBloque busca el
  // hora_inicio más CERCANO, no el bloque que contiene al timestamp. A las 11:50 el
  // bloque 2 (14:30, a 160 min) está más cerca que el bloque 1 (08:00, a 230 min), así
  // que atribuirBloque devuelve el 2 — usarlo como criterio silenciaba el aviso justo en
  // el caso más común (salir a mediodía). Este test falla si alguien vuelve a atarlo ahí.
  const salidaMediodia = new Date('2026-06-20T15:50:00Z'); // 11:50 local
  assert.equal(atribuirBloque(salidaMediodia, BLOQUES_PARTIDO).numero_bloque, 2);
  assert.equal(bloquePendienteTrasSalida(salidaMediodia, BLOQUES_PARTIDO), '14:30:00');
});

// ── Horario por día de la semana (2026-07-31) ─────────────────────────────────────────
// Caso real: Administración lunes a viernes horario partido, sábado un solo bloque
// distinto (09:00-13:00), domingo no trabaja. 2026-06-20 es sábado, 2026-06-21 domingo,
// 2026-06-22 lunes (Bolivia, UTC-4) — verificado con Date.UTC antes de escribir el test,
// no asumido de memoria.
test('diaSemanaLocal devuelve ISO 1=lunes..7=domingo en hora de Bolivia', () => {
  assert.equal(diaSemanaLocal(new Date('2026-06-22T15:00:00Z')), 1); // lunes 11:00 local
  assert.equal(diaSemanaLocal(new Date('2026-06-20T15:00:00Z')), 6); // sábado 11:00 local
  assert.equal(diaSemanaLocal(new Date('2026-06-21T15:00:00Z')), 7); // domingo 11:00 local
  // Cruce de medianoche: 2026-06-20T02:00Z son las 22:00 del 2026-06-19 en Bolivia (viernes).
  assert.equal(diaSemanaLocal(new Date('2026-06-20T02:00:00Z')), 5);
});

const BLOQUES_ADMINISTRACION = [
  { numero_bloque: 1, hora_inicio: '08:00:00', hora_fin: '12:00:00', dias_semana: [1, 2, 3, 4, 5] },
  { numero_bloque: 2, hora_inicio: '14:30:00', hora_fin: '18:30:00', dias_semana: [1, 2, 3, 4, 5] },
  { numero_bloque: 3, hora_inicio: '09:00:00', hora_fin: '13:00:00', dias_semana: [6] },
];

test('atribuirBloque respeta el día de la semana, no solo la hora más cercana', () => {
  // Lunes 08:05 -> bloque 1 (L-V mañana), ignora el de sábado aunque sea 1 sola opción hoy.
  const lunes = new Date('2026-06-22T12:05:00Z'); // 08:05 local
  assert.equal(atribuirBloque(lunes, BLOQUES_ADMINISTRACION).numero_bloque, 1);

  // Sábado 09:30 -> bloque 3 (el único que aplica), aunque el bloque 1 (08:00, L-V) esté
  // más cerca en minutos "de reloj" que el 3 no importa: hoy el 1 no aplica.
  const sabado = new Date('2026-06-20T13:30:00Z'); // 09:30 local
  assert.equal(atribuirBloque(sabado, BLOQUES_ADMINISTRACION).numero_bloque, 3);

  // Domingo: ningún bloque aplica -> null, nunca un bloque equivocado.
  const domingo = new Date('2026-06-21T14:00:00Z'); // 10:00 local
  assert.equal(atribuirBloque(domingo, BLOQUES_ADMINISTRACION), null);
});

test('bloquePendienteTrasSalida filtra por día antes de contar bloques (área con 3 en total)', () => {
  // Sábado: hoy solo aplica 1 bloque (el 3) de los 3 que tiene el área en total — sin
  // filtrar por día, bloques.length sería 3 y el aviso nunca se dispararía para nadie,
  // ni siquiera entre semana (regresión real posible al agregar el bloque de sábado).
  const salidaSabado = new Date('2026-06-20T14:00:00Z'); // 10:00 local, sábado
  assert.equal(bloquePendienteTrasSalida(salidaSabado, BLOQUES_ADMINISTRACION), null);

  // Entre semana sigue funcionando igual que con un área de 2 bloques nomás.
  const salidaLunesMediodia = new Date('2026-06-22T15:50:00Z'); // 11:50 local, lunes
  assert.equal(bloquePendienteTrasSalida(salidaLunesMediodia, BLOQUES_ADMINISTRACION), '14:30:00');
});
