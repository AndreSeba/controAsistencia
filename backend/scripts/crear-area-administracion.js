// Crea el área real "Administración" con horario partido (8:00-12:00 y 14:30-18:30)
// vía la API (pasa por validación + auditoría, igual que desde el panel).
// Correr con: node --env-file=.env scripts/crear-area-administracion.js
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'rrhh@pizzario.bo';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'CambiarEsto_2026!';

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then(r => r.json());

  if (!login.accessToken) {
    console.error('No se pudo loguear:', login);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${login.accessToken}` };

  const existentes = await fetch(`${BASE}/turnos`, { headers: auth }).then(r => r.json());
  const yaExiste = existentes.find(a => a.nombre.toLowerCase() === 'administración');
  if (yaExiste) {
    console.log('El área "Administración" ya existe (id', yaExiste.id + '):', JSON.stringify(yaExiste, null, 2));
    process.exit(0);
  }

  const res = await fetch(`${BASE}/turnos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Administración',
      bloques: [
        { horaInicio: '08:00', horaFin: '12:00' },
        { horaInicio: '14:30', horaFin: '18:30' },
      ],
      aplicaDescuento: true,
    }),
  });
  const body = await res.json();
  console.log(`HTTP ${res.status}:`, JSON.stringify(body, null, 2));
  process.exit(res.status === 201 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
