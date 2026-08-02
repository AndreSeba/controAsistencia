const express = require('express');

const visitasController = require('../controllers/visitas.controller');
const { verificarDispositivo } = require('../middleware/dispositivo.middleware');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

// PWA del supervisor: autenticada por device token (el service valida es_supervisor).
router.post('/', verificarDispositivo, visitasController.registrar);

// Panel RRHH: reporte por JWT + RBAC.
router.get('/resumen', verificarAccessToken, requierePermiso('visitas', 'puede_ver'), visitasController.resumen);
router.get('/export', verificarAccessToken, requierePermiso('visitas', 'puede_ver'), visitasController.exportar);
router.get('/', verificarAccessToken, requierePermiso('visitas', 'puede_ver'), visitasController.listar);

module.exports = router;
