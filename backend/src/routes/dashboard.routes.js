const express = require('express');

const dashboardController = require('../controllers/dashboard.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verificarAccessToken);

// Reusa el permiso de "marcaciones": el resumen de hoy es una vista agregada de lo mismo.
router.get('/resumen', requierePermiso('marcaciones', 'puede_ver'), dashboardController.resumen);
router.get('/ranking', requierePermiso('marcaciones', 'puede_ver'), dashboardController.ranking);

module.exports = router;
