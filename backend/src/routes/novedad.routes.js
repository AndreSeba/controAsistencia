const express = require('express');
const novedadController = require('../controllers/novedad.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(verificarAccessToken);

router.get('/',                        requierePermiso('novedades', 'puede_ver'),    novedadController.listar);
router.post('/',                       requierePermiso('novedades', 'puede_editar'), novedadController.guardar);
router.delete('/:empleadoId/:fecha',   requierePermiso('novedades', 'puede_editar'), novedadController.eliminar);

module.exports = router;
