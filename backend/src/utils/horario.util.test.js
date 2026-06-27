const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  minutosDelDiaLocal,
  fechaLocal,
  atribuirTurno,
  calcularMinutosAtraso,
  calcularMinutosAnticipacion,
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
