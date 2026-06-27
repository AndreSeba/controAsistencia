const express = require('express');

const turnosController = require('../controllers/turnos.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verificarAccessToken);

router.get('/', requierePermiso('turnos', 'puede_ver'), turnosController.listar);
router.put('/:id', requierePermiso('turnos', 'puede_editar'), turnosController.actualizarHorario);

module.exports = router;
