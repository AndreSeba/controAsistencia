const express = require('express');

const empleadosController = require('../controllers/empleados.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');
const { uploadImagen } = require('../middleware/upload.middleware');

const router = express.Router();

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
