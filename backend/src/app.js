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
const { UPLOADS_DIR } = require('./services/almacenamiento.service');

const app = express();

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
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));

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
