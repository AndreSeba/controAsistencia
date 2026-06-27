const express = require('express');

const qrTokenController = require('../controllers/qrToken.controller');

const router = express.Router();

// Sin auth: esta es la pantalla/tablet de la sucursal. El token rotativo de TTL corto
// es la propia garantía de seguridad (cualquiera presente físicamente puede verlo).
router.get('/:id/qr', qrTokenController.obtenerVigente);

module.exports = router;
