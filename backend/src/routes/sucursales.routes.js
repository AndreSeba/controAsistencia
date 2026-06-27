const express = require('express');

const sucursalesController = require('../controllers/sucursales.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verificarAccessToken);

router.get('/', requierePermiso('sucursales', 'puede_ver'), sucursalesController.listar);
router.get('/:id', requierePermiso('sucursales', 'puede_ver'), sucursalesController.obtener);
router.post('/', requierePermiso('sucursales', 'puede_editar'), sucursalesController.crear);
router.put('/:id', requierePermiso('sucursales', 'puede_editar'), sucursalesController.actualizarDatos);
router.put('/:id/geocerca', requierePermiso('sucursales', 'puede_editar'), sucursalesController.actualizarGeocerca);

module.exports = router;
