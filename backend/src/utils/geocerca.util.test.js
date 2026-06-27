const { test } = require('node:test');
const assert = require('node:assert/strict');

const { distanciaMetros, dentroDeGeocerca } = require('./geocerca.util');

test('distanciaMetros entre el mismo punto es 0', () => {
  assert.equal(distanciaMetros(-17.7833, -63.1821, -17.7833, -63.1821), 0);
});

test('distanciaMetros da un valor razonable para ~1km de separación', () => {
  // ~0.009 grados de latitud equivalen a ~1000m
  const d = distanciaMetros(-17.7833, -63.1821, -17.7923, -63.1821);
  assert.ok(d > 950 && d < 1050, `esperaba ~1000m, dio ${d}`);
});

test('dentroDeGeocerca es false si falta GPS (señal blanda, nunca bloquea)', () => {
  assert.equal(dentroDeGeocerca(null, null, -17.7833, -63.1821, 100), false);
});

test('dentroDeGeocerca respeta el radio exacto', () => {
  assert.equal(dentroDeGeocerca(-17.7833, -63.1821, -17.7833, -63.1821, 50), true);
  const lejos = -17.7833 + 0.01; // ~1100m
  assert.equal(dentroDeGeocerca(lejos, -63.1821, -17.7833, -63.1821, 100), false);
});
