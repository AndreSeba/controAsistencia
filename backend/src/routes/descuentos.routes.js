const express = require('express');

const descuentosController = require('../controllers/descuentos.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verificarAccessToken);

router.get('/', requierePermiso('descuentos', 'puede_ver'), descuentosController.listar);
router.get('/reporte', requierePermiso('descuentos', 'puede_ver'), descuentosController.reporte);
router.get('/reporte/export', requierePermiso('descuentos', 'puede_ver'), descuentosController.exportarReporte);
router.put('/:id/avanzar', requierePermiso('descuentos', 'puede_editar'), descuentosController.avanzar);

module.exports = router;
