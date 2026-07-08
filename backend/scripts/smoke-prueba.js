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

  // ── Configuración: pago por día ──
  const config = await fetch(`${BASE}/configuracion`, { headers: auth }).then(r => r.json());
  check('GET /configuracion incluye pagoDiaBs', typeof config.pagoDiaBs === 'number', `pagoDiaBs=${config.pagoDiaBs}`);

  // ── Perfil del dispositivo (PWA) ──
  const yo = await fetch(`${BASE}/empleados/yo`, { headers: { 'x-device-token': disp.device_token } });
  const yoBody = await yo.json();
  check('GET /empleados/yo con device token → 200', yo.status === 200 && typeof yoBody.esSupervisor === 'boolean');

  // ── Áreas con horario partido (caso real: Administración 08-12 y 14:30-18:30) ──
  const areaPartida = await fetch(`${BASE}/turnos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'ADMIN SMOKE',
      bloques: [{ horaInicio: '08:00', horaFin: '12:00' }, { horaInicio: '14:30', horaFin: '18:30' }],
      aplicaDescuento: false,
    }),
  });
  const areaBody = await areaPartida.json();
  check('POST /turnos con 2 bloques → 201', areaPartida.status === 201, areaBody.nombre);
  check('El área devuelve los 2 bloques', areaBody.bloques?.length === 2
    && areaBody.bloques[0].hora_inicio === '08:00' && areaBody.bloques[1].hora_inicio === '14:30');
  check('aplica_descuento=false persistido', areaBody.aplica_descuento === false);

  // Bloques que se solapan o no respetan el orden → rechazado
  const areaSolapada = await fetch(`${BASE}/turnos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'SOLAPADA SMOKE',
      bloques: [{ horaInicio: '08:00', horaFin: '14:00' }, { horaInicio: '12:00', horaFin: '18:00' }],
    }),
  });
  check('POST /turnos con bloques solapados → 400', areaSolapada.status === 400);

  // Área normal de 1 bloque para comparar
  const areaSimple = await fetch(`${BASE}/turnos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'SIMPLE SMOKE', bloques: [{ horaInicio: '06:15', horaFin: '14:15' }] }),
  });
  const areaSimpleBody = await areaSimple.json();
  check('POST /turnos con 1 bloque → 201', areaSimple.status === 201);

  const empActual = await fetch(`${BASE}/empleados/${disp.empleado_id}`, { headers: auth }).then(r => r.json());
  async function actualizarEmpleado(extra) {
    return fetch(`${BASE}/empleados/${disp.empleado_id}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: empActual.nombre, apellido: empActual.apellido, documentoNro: empActual.documento_nro,
        telefono: empActual.telefono, esSupervisor: empActual.es_supervisor, ...extra,
      }),
    });
  }

  const empConArea = await actualizarEmpleado({ areaTurnoId: areaBody.id });
  const empConAreaBody = await empConArea.json();
  check('PUT /empleados asigna área partida', empConArea.status === 200 && empConAreaBody.area_nombre === 'ADMIN SMOKE');

  // Asegurar que no quede una jornada ABIERTA de un test anterior — si no, la
  // próxima marcación resolvería como SALIDA y nunca se calcularía atraso.
  await pool.query(
    "UPDATE turno_jornada SET estado = 'CERRADO', salida_marcada = TRUE WHERE empleado_id = $1 AND estado = 'ABIERTO'",
    [disp.empleado_id]
  );

  // ── El caso real: marcar entrada a las 14:35 (vuelta del almuerzo) debe dar
  // atraso ~5 min contra el bloque 2 (14:30), NO ~390 min contra el bloque 1 (08:00).
  const hoy = new Date();
  const hoy1435 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 18, 35)); // 14:35 Bolivia = 18:35 UTC
  const { otp: otp1435 } = await TOTP.generate(suc.totp_secret, { digits: 6, period: 30, timestamp: hoy1435.getTime() });
  const marcTarde = await fetch(`${BASE}/marcaciones`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token },
    body: formMarcacion({
      sucursalId: suc.id, qrToken: otp1435, livenessNonce: 'offline-x',
      extra: { offlineMode: 'true', timestampOffline: hoy1435.getTime() },
    }),
  });
  const marcTardeBody = await marcTarde.json();
  const marcTardeFila = marcTarde.status === 201
    ? (await pool.query('SELECT minutos_atraso, tipo FROM marcacion WHERE id = $1', [marcTardeBody.id])).rows[0]
    : null;
  check('Entrada 14:35 en área partida → atraso contra bloque 2 (~5 min, no ~390)',
    marcTarde.status === 201 && marcTardeFila?.tipo === 'ENTRADA'
      && marcTardeFila?.minutos_atraso != null && marcTardeFila.minutos_atraso <= 10,
    `tipo=${marcTardeFila?.tipo} minutos_atraso=${marcTardeFila?.minutos_atraso}`);

  // aplica_descuento=false: aunque llegó tarde, NO debe haberse creado un descuento.
  const descuentosDeEstaMarca = await pool.query(
    'SELECT id FROM descuento WHERE marcacion_id = $1', [marcTardeBody.id]
  );
  check('Área con aplica_descuento=false NO genera descuento pese al atraso',
    descuentosDeEstaMarca.rows.length === 0);

  // Cerrar la jornada que quedó abierta por la prueba (para no ensuciar futuras corridas)
  if (marcTarde.status === 201) {
    await pool.query(
      `UPDATE turno_jornada SET estado = 'CERRADO', salida_marcada = TRUE
       WHERE id = (SELECT turno_jornada_id FROM marcacion WHERE id = $1)`,
      [marcTardeBody.id]
    );
  }

  // Con empleados asignados el área no se puede eliminar
  const delBloqueado = await fetch(`${BASE}/turnos/${areaBody.id}`, { method: 'DELETE', headers: auth });
  check('DELETE área con empleados asignados → 409', delBloqueado.status === 409);

  // Desasignar y eliminar las 2 áreas de prueba
  await actualizarEmpleado({ areaTurnoId: null });
  const delOk = await fetch(`${BASE}/turnos/${areaBody.id}`, { method: 'DELETE', headers: auth });
  check('DELETE área sin asignados → 204', delOk.status === 204);
  await fetch(`${BASE}/turnos/${areaSimpleBody.id}`, { method: 'DELETE', headers: auth });

  // ── Planilla quincenal ──
  const plan = await fetch(`${BASE}/descuentos/planilla?fechaInicio=2026-06-28&fechaFin=2026-07-13`, { headers: auth });
  const planBody = await plan.json();
  const matematicaOk = planBody.filas.every(f => f.total_bs === f.ganado_bs - f.descuentos_bs
    && f.ganado_bs === f.dias_trabajados * planBody.pagoDiaBs);
  check('GET /descuentos/planilla → 200 y total = ganado − descuentos', plan.status === 200 && matematicaOk,
    `${planBody.filas.length} empleados, pago/día ${planBody.pagoDiaBs} Bs`);

  // ── Visitas de supervisor ──
  const { otp: otpVisita } = await TOTP.generate(suc.totp_secret, { digits: 6, period: 30 });
  const visitaNoSup = await fetch(`${BASE}/visitas`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sucursalId: suc.id, qrToken: otpVisita }),
  });
  check('POST /visitas sin ser supervisor → 403', visitaNoSup.status === 403);

  await pool.query('UPDATE empleado SET es_supervisor = TRUE WHERE id = $1', [disp.empleado_id]);
  const visitaOk = await fetch(`${BASE}/visitas`, {
    method: 'POST',
    headers: { 'x-device-token': disp.device_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sucursalId: suc.id, qrToken: otpVisita, gpsLat: -17.78, gpsLng: -63.18 }),
  });
  const visitaBody = await visitaOk.json();
  check('POST /visitas como supervisor → 201', visitaOk.status === 201, visitaBody.sucursal);

  const hoyLocal = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
  const resumenVisitas = await fetch(`${BASE}/visitas/resumen?fechaInicio=${hoyLocal}&fechaFin=${hoyLocal}`, { headers: auth });
  const resumenBody = await resumenVisitas.json();
  check('GET /visitas/resumen incluye la visita', resumenVisitas.status === 200
    && resumenBody.some(r => r.empleado_id === disp.empleado_id && r.visitas >= 1));

  // Cleanup visitas de prueba
  await pool.query('DELETE FROM visita_supervisor WHERE id = $1', [visitaBody.id]);
  await pool.query('UPDATE empleado SET es_supervisor = FALSE WHERE id = $1', [disp.empleado_id]);

  console.log(fallos === 0 ? '\nTodo OK ✔' : `\n${fallos} verificaciones fallaron ✘`);
  await pool.end();
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test abortado:', err);
  process.exit(1);
});
