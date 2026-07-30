const express = require('express');
const rateLimit = require('express-rate-limit');

const empleadosController = require('../controllers/empleados.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');
const { identificarDispositivo } = require('../middleware/dispositivo.middleware');
const { uploadImagen } = require('../middleware/upload.middleware');

const router = express.Router();

// Límite propio del endpoint de auto-activación, keyeado por CI y NO por IP.
//
// Por IP no sirve acá: el tráfico real llega cliente -> Vercel -> Nginx, así que con
// `trust proxy: 1` req.ip es el edge de Vercel para TODO el mundo. Un límite por IP se
// volvería un cupo global compartido y la activación se rompería para todos apenas unas
// pocas personas la usaran (mismo problema que el rate limit general, ver app.js).
//
// Por CI sí acota la amenaza real: probar muchas selfies contra un empleado concreto
// para colarse en su face-match. La enumeración de CIs no necesita límite porque la
// respuesta es idéntica para todos los motivos de rechazo (ver RECHAZO_GENERICO en
// dispositivos.service.js) — probar CIs no revela cuáles existen. Y el face-match, que
// es lo caro (~3,5s de CPU), solo corre si el CI existe, tiene biometría y no tiene
// dispositivo: un CI inventado se rechaza mucho antes de llegar ahí.
const autoActivacionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `autoact:${(req.body?.documentoNro || '').trim() || req.ip}`,
});

// PWA: perfil del dueño del device token. Definida ANTES del verificarAccessToken
// global — la pantalla del empleado no tiene JWT, su credencial es el dispositivo.
// identificarDispositivo (no verificarDispositivo): acá todavía no hay un empleadoId
// elegido si el token es de un dispositivo corporativo compartido — es justamente el
// endpoint que la PWA usa para decidir si mostrar la pantalla "¿Quién sos?".
router.get('/yo', identificarDispositivo, empleadosController.yo);

// PWA: canjea el código de activación de un solo uso por el device_token real.
// Mismo criterio que /yo — sin JWT, todavía no hay ninguna credencial que exigir.
router.post('/activar-dispositivo', empleadosController.activarDispositivo);

// PWA: link genérico de auto-activación (CI + selfie). Mismo criterio sin JWT que los
// dos anteriores. multer va ANTES del rate limiter porque este keyea por documentoNro,
// que viaja en el multipart y no existe en req.body hasta que multer lo parsea (mismo
// gotcha de orden que POST /marcaciones, ver marcaciones.routes.js). Parsear una selfie
// de ~30KB es barato al lado del face-match, que es lo que el límite protege de verdad.
router.post(
  '/autoactivar-dispositivo',
  uploadImagen.single('selfie'),
  autoActivacionLimiter,
  empleadosController.autoActivarDispositivo
);

router.use(verificarAccessToken);

router.get('/', requierePermiso('empleados', 'puede_ver'), empleadosController.listar);
router.get('/:id', requierePermiso('empleados', 'puede_ver'), empleadosController.obtener);
router.post('/', requierePermiso('empleados', 'puede_editar'), empleadosController.crear);
router.put('/:id', requierePermiso('empleados', 'puede_editar'), empleadosController.actualizar);

router.post(
  '/:id/dispositivo',
  requierePermiso('empleados', 'puede_editar'),
  empleadosController.enrolarDispositivo
);
router.get(
  '/:id/dispositivo/enlace',
  requierePermiso('empleados', 'puede_ver'),
  empleadosController.obtenerEnlaceDispositivo
);
router.delete(
  '/:id/dispositivo/:dispositivoId',
  requierePermiso('empleados', 'puede_editar'),
  empleadosController.revocarDispositivo
);

router.post(
  '/:id/biometria',
  requierePermiso('empleados', 'puede_editar'),
  uploadImagen.single('foto'),
  empleadosController.enrolarBiometria
);

module.exports = router;
