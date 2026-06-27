const express = require('express');

const marcacionesController = require('../controllers/marcaciones.controller');
const { verificarDispositivo } = require('../middleware/dispositivo.middleware');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');
const { uploadImagen } = require('../middleware/upload.middleware');

const router = express.Router();

// PWA del empleado: autenticada por device_token (Modelo A, sin login JWT).
router.post('/reto-liveness', verificarDispositivo, marcacionesController.retoLiveness);
router.post('/', verificarDispositivo, uploadImagen.single('selfie'), marcacionesController.registrar);

// Panel RRHH: lectura por JWT + RBAC.
router.get('/', verificarAccessToken, requierePermiso('marcaciones', 'puede_ver'), marcacionesController.listar);
router.get('/export', verificarAccessToken, requierePermiso('marcaciones', 'puede_ver'), marcacionesController.exportar);
router.put('/:id/revisar', verificarAccessToken, requierePermiso('marcaciones', 'puede_editar'), marcacionesController.revisar);

module.exports = router;
