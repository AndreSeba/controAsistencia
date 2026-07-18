const express = require('express');

const empleadosController = require('../controllers/empleados.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');
const { identificarDispositivo } = require('../middleware/dispositivo.middleware');
const { uploadImagen } = require('../middleware/upload.middleware');

const router = express.Router();

// PWA: perfil del dueño del device token. Definida ANTES del verificarAccessToken
// global — la pantalla del empleado no tiene JWT, su credencial es el dispositivo.
// identificarDispositivo (no verificarDispositivo): acá todavía no hay un empleadoId
// elegido si el token es de un dispositivo corporativo compartido — es justamente el
// endpoint que la PWA usa para decidir si mostrar la pantalla "¿Quién sos?".
router.get('/yo', identificarDispositivo, empleadosController.yo);

// PWA: canjea el código de activación de un solo uso por el device_token real.
// Mismo criterio que /yo — sin JWT, todavía no hay ninguna credencial que exigir.
router.post('/activar-dispositivo', empleadosController.activarDispositivo);

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
