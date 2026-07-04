// Smoke test de pre-entrega: recorre login, RBAC, QR de pantalla, marcación
// online/offline (TOTP server-side), novedades y reglas de descuento contra un
// backend corriendo en localhost:3001. Correr con:
//   node --env-file=.env scripts/smoke-prueba.js
// No borra nada; las marcaciones que crea quedan como datos de prueba.

const { getPool } = require('../src/config/db');
const { TOTP } = require('totp-generator');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'rrhh@pizzario.bo';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'CambiarEsto_2026!';

// PNG 1x1 válido: pasa el fileFilter de multer; sin cara → identidadVerificada=false.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let fallos = 0;
function check(nombre, condicion, detalle = '') {
  const tag = condicion ? 'PASS' : 'FAIL';
  if (!condicion) fallos++;
  console.log(`[${tag}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

function formMarcacion({ sucursalId, qrToken, livenessNonce, extra = {} }) {
  const form = new FormData();
  form.append('selfie', new Blob([PNG_1X1], { type: 'image/png' }), 'selfie.png');
  form.append('sucursalId', String(sucursalId));
  form.append('qrToken', qrToken);
  form.append('livenessNonce', livenessNonce);
  for (const [k, v] of Object.entries(extra)) form.append(k, String(v));
  return form;
}

async function main() {
  const pool = getPool();

  // ── Datos de apoyo desde la BD ──
  const suc = (await pool.query(
    `SELECT id, nombre, totp_secret, pantalla_token FROM sucursal
     WHERE activo = TRUE AND totp_secret IS NOT NULL AND pantalla_token IS NOT NULL
     LIMIT 1`
  )).rows[0];
  check('Sucursal con totp_secret y pantalla_token en BD', !!suc, suc?.nombre);
  if (!suc) process.exit(1);

  const disp = (await pool.query(
    `SELECT d.device_token, d.empleado_id, e.nombre
     FROM dispositivo_empleado d JOIN empleado e ON e.id = d.empleado_id
     WHERE d.estado = 'activo' LIMIT 1`
  )).rows[0];
  check('Dispositivo enrolado activo en BD', !!disp, disp?.nombre);
  if (!disp) process.exit(1);

  // ── Health ──
  const health = await fetch(`${BASE}/health`).then(r => r.json()).catch(() => null);
  check('GET /health', health?.ok === true);

  // ── Login + RBAC ──
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const login = await loginRes.json();
  check('POST /auth/login', loginRes.status === 200 && !!login.accessToken);
  const auth = { Authorization: `Bearer ${login.accessToken}` };

  const sinToken = await fetch(`${BASE}/empleados`);
  check('GET /empleados sin token → 401', sinToken.status === 401);

  const empleados = await fetch(`${BASE}/empleados`, { headers: auth });
  check('GET /empleados con token → 200', empleados.status === 200);

  // ── QR de pantalla: token obligatorio ──
  const qrSinK = await fetch(`${BASE}/sucursales/${suc.id}/qr`);
  check('GET /:id/qr sin ?k → 401', qrSinK.status === 401);

  const qrMalK = await fetch(`${BASE}/sucursales/${suc.id}/qr?k=invalido`);
  check('GET /:id/qr con k inválido → 401', qrMalK.status === 401);

  const qrOk = await fetch(`${BASE}/sucursales/${suc.id}/qr?k=${suc.pantalla_token}`);
  const qrBody = await qrOk.json();
  check('GET /:id/qr con k válido → 200 + secreto', qrOk.status === 200 && qrBody.totpSecret === suc.totp_secret);

  // ── Marcación ONLINE (TOTP vigente + liveness real) ──
  const reto = await fetch(`${BASE}/marcaciones/reto-liveness`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
  }).then(r => r.json());
  check('POST /reto-liveness con device token', !!reto.nonce, reto.tipoReto);

  const { otp: otpAhora } = await TOTP.generate(suc.totp_secret, { digits: 6, period: 30 });
  const online = await fetch(`${BASE}/marcaciones`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
    body: formMarcacion({ sucursalId: suc.id, qrToken: otpAhora, livenessNonce: reto.nonce }),
  });
  const onlineBody = await online.json();
  check('POST /marcaciones online (TOTP vigente) → 201', online.status === 201, `tipo=${onlineBody.tipo} estado=${onlineBody.estado}`);

  // ── Marcación online con TOTP falso → 401 ──
  const reto2 = await fetch(`${BASE}/marcaciones/reto-liveness`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
  }).then(r => r.json());
  const malToken = await fetch(`${BASE}/marcaciones`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
    body: formMarcacion({ sucursalId: suc.id, qrToken: '000000', livenessNonce: reto2.nonce }),
  });
  check('POST /marcaciones con TOTP falso → 401', malToken.status === 401);

  // ── Marcación OFFLINE: TOTP del momento declarado (hace 2h) ──
  const hace2h = Date.now() - 2 * 60 * 60 * 1000;
  const { otp: otp2h } = await TOTP.generate(suc.totp_secret, { digits: 6, period: 30, timestamp: hace2h });
  const offline = await fetch(`${BASE}/marcaciones`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
    body: formMarcacion({
      sucursalId: suc.id, qrToken: otp2h, livenessNonce: 'offline-x',
      extra: { offlineMode: 'true', timestampOffline: hace2h },
    }),
  });
  const offlineBody = await offline.json();
  check('POST offline (TOTP de hace 2h) → 201', offline.status === 201, `tipo=${offlineBody.tipo} estado=${offlineBody.estado}`);
  check('Marca offline queda en requiere_revision', offlineBody.estado === 'requiere_revision');

  // ── Offline con timestamp fuera de rango (72h) → 422 ──
  const hace3d = Date.now() - 72 * 60 * 60 * 1000;
  const { otp: otp3d } = await TOTP.generate(suc.totp_secret, { digits: 6, period: 30, timestamp: hace3d });
  const viejo = await fetch(`${BASE}/marcaciones`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
    body: formMarcacion({
      sucursalId: suc.id, qrToken: otp3d, livenessNonce: 'offline-x',
      extra: { offlineMode: 'true', timestampOffline: hace3d },
    }),
  });
  check('POST offline con fecha de hace 3 días → 422', viejo.status === 422);

  // ── Device token inválido → 401 ──
  const dispFalso = await fetch(`${BASE}/marcaciones/reto-liveness`, {
    method: 'POST',
    headers: { 'x-device-token': 'token-falso' },
  });
  check('reto-liveness con device token falso → 401', dispFalso.status === 401);

  // ── Novedades ──
  const novMal = await fetch(`${BASE}/novedades?fechaInicio=hola&fechaFin=2026-07-31`, { headers: auth });
  check('GET /novedades con fecha malformada → 400', novMal.status === 400);

  const novOk = await fetch(`${BASE}/novedades?fechaInicio=2026-06-01&fechaFin=2026-06-30`, { headers: auth });
  check('GET /novedades rango válido → 200', novOk.status === 200);

  // ── Reglas de descuento ──
  const reglas = await fetch(`${BASE}/descuentos/reglas`, { headers: auth });
  const reglasBody = await reglas.json();
  check('GET /descuentos/reglas → 200 + 6 bandas', reglas.status === 200 && reglasBody.length === 6);

  const reglaMal = await fetch(`${BASE}/descuentos/reglas/${reglasBody[0].id}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto_bs: -5 }),
  });
  check('PUT /reglas con monto negativo → 400', reglaMal.status === 400);

  console.log(fallos === 0 ? '\nTodo OK ✔' : `\n${fallos} verificaciones fallaron ✘`);
  await pool.end();
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test abortado:', err);
  process.exit(1);
});
