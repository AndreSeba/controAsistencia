const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const sucursalesRoutes = require('./routes/sucursales.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const qrRoutes = require('./routes/qr.routes');
const marcacionesRoutes = require('./routes/marcaciones.routes');
const descuentosRoutes = require('./routes/descuentos.routes');
const turnosRoutes = require('./routes/turnos.routes');
const configuracionRoutes = require('./routes/configuracion.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const novedadRoutes = require('./routes/novedad.routes');
const visitasRoutes = require('./routes/visitas.routes');
const dispositivosCorporativosRoutes = require('./routes/dispositivosCorporativos.routes');

const app = express();

// Detrás de Nginx (VPS) el socket de cada request es siempre 127.0.0.1 — sin esto,
// req.ip es localhost para TODO el mundo: el rate limit de abajo se vuelve un cupo
// GLOBAL compartido entre todos los usuarios a la vez (429 colectivo en un cambio de
// turno) y la auditoría guarda 127.0.0.1 en vez de la IP real. "1" = confiar solo en
// el primer proxy (el Nginx propio, que setea X-Forwarded-For) — nunca `true`, que
// confiaría en cualquier cadena y dejaría a un cliente directo falsificar su IP
// mandando su propio header. En dev (sin proxy) no cambia nada: sin X-Forwarded-For,
// req.ip sigue siendo la dirección del socket.
app.set('trust proxy', 1);

app.use(helmet());

// Lista explícita de orígenes permitidos — nunca reflejar "true" junto con credentials:
// eso permitiría que cualquier sitio leyera respuestas usando la cookie de sesión
// de un RRHH logueado (CSRF de lectura). Sin Origin (curl, Postman, server-to-server)
// se permite siempre porque ahí no hay navegador haciendo cumplir CORS.
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || ORIGENES_PERMITIDOS.includes(origin)) return callback(null, true);
    // Con status explícito: sin él, el error handler lo trata como 500 "Error interno"
    // y desde el cliente es imposible saber que el problema es el origen (p.ej. la IP
    // de LAN cambió por DHCP y ya no coincide con CORS_ORIGINS).
    const err = new Error(`Origen no permitido (${origin}). Agregalo a CORS_ORIGINS del backend.`);
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
// Selfies/fotos van a Supabase Storage (URL completa devuelta por almacenamiento.service.js),
// no a disco local — Render no tiene filesystem persistente entre redeploys.

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 });
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
// qr.routes debe montarse antes de sucursalesRoutes: ambos cuelgan de /api/sucursales,
// pero /:id/qr es la única ruta sin JWT (pantalla física de sucursal).
app.use('/api/sucursales', qrRoutes);
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/marcaciones', marcacionesRoutes);
app.use('/api/descuentos', descuentosRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/novedades', novedadRoutes);
app.use('/api/visitas', visitasRoutes);
app.use('/api/dispositivos-corporativos', dispositivosCorporativosRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  // Solo los errores "conocidos" (clases propias, siempre con .status explícito)
  // exponen su mensaje al cliente. Un error inesperado (bug, fallo de Postgres, etc.)
  // podría filtrar detalles internos en err.message — ahí nunca se manda tal cual.
  const status = err.status || 500;
  const mensaje = err.status ? err.message : 'Error interno';
  res.status(status).json({ error: mensaje });
});

module.exports = app;
