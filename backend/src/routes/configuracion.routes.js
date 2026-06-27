const express = require('express');

const configuracionController = require('../controllers/configuracion.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verificarAccessToken);

router.get('/', requierePermiso('configuracion', 'puede_ver'), configuracionController.obtener);
router.put('/', requierePermiso('configuracion', 'puede_editar'), configuracionController.actualizar);

module.exports = router;
