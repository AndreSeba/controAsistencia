const express = require('express');

const configuracionController = require('../controllers/configuracion.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');
const { uploadImagen } = require('../middleware/upload.middleware');

const router = express.Router();

// PÚBLICA, y declarada ANTES del verificarAccessToken de abajo: la PWA del empleado no
// tiene JWT (su credencial es el device_token) y necesita el logo incluso en la pantalla
// de configurar el teléfono, donde todavía no hay dispositivo. Solo devuelve la URL del
// logo — ningún parámetro de negocio.
router.get('/publica', configuracionController.obtenerPublica);

router.use(verificarAccessToken);

router.get('/', requierePermiso('configuracion', 'puede_ver'), configuracionController.obtener);
router.put('/', requierePermiso('configuracion', 'puede_editar'), configuracionController.actualizar);

router.post(
  '/logo',
  requierePermiso('configuracion', 'puede_editar'),
  uploadImagen.single('logo'),
  configuracionController.subirLogo
);
router.delete(
  '/logo',
  requierePermiso('configuracion', 'puede_editar'),
  configuracionController.quitarLogo
);

module.exports = router;
