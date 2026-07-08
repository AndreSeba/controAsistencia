// Mide contra producción (Render) la operación real de registrar entrada/salida,
// para diagnosticar dónde se va el tiempo. No crea datos persistentes de más
// que una marcación real (queda en la BD, no se borra automático).
const { TOTP } = require('totp-generator');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const BASE = 'https://controasistencia.onrender.com/api';
const DEVICE_TOKEN = process.argv[2];
const SUCURSAL_ID = process.argv[3];
const TOTP_SECRET = process.argv[4];

async function medir(nombre, fn) {
  const t0 = Date.now();
  const res = await fn();
  const ms = Date.now() - t0;
  console.log(`${nombre}: ${res.status} — ${ms} ms`);
  return res;
}

async function main() {
  const reto = await medir('POST /reto-liveness (1 consulta, sin bcrypt/face-match)', () =>
    fetch(`${BASE}/marcaciones/reto-liveness`, { method: 'POST', headers: { 'x-device-token': DEVICE_TOKEN } })
  );
  const retoBody = await reto.json();

  const { otp } = await TOTP.generate(TOTP_SECRET, { digits: 6, period: 30 });
  const form = new FormData();
  form.append('selfie', new Blob([PNG_1X1], { type: 'image/png' }), 'selfie.png');
  form.append('sucursalId', String(SUCURSAL_ID));
  form.append('qrToken', otp);
  form.append('livenessNonce', retoBody.nonce);

  await medir('POST /marcaciones (flujo completo: liveness+face-match+storage+turno)', () =>
    fetch(`${BASE}/marcaciones`, { method: 'POST', headers: { 'x-device-token': DEVICE_TOKEN }, body: form })
  );
}

main().catch(err => { console.error(err); process.exit(1); });
