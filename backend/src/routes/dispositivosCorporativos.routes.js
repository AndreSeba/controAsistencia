const express = require('express');

const controller = require('../controllers/dispositivosCorporativos.controller');
const { verificarAccessToken, requierePermiso } = require('../middleware/auth.middleware');

const router = express.Router();

// Panel RRHH únicamente: crear/gestionar celulares corporativos y sus habilitaciones.
router.use(verificarAccessToken);

router.get('/', requierePermiso('dispositivos_corporativos', 'puede_ver'), controller.listar);
router.post('/', requierePermiso('dispositivos_corporativos', 'puede_editar'), controller.crear);
router.get('/:id/enlace', requierePermiso('dispositivos_corporativos', 'puede_ver'), controller.obtenerEnlace);
router.put('/:id/sucursal', requierePermiso('dispositivos_corporativos', 'puede_editar'), controller.reasignarSucursal);
router.delete('/:id', requierePermiso('dispositivos_corporativos', 'puede_editar'), controller.revocar);

router.get('/:id/empleados', requierePermiso('dispositivos_corporativos', 'puede_ver'), controller.listarEmpleadosHabilitados);
router.post('/:id/empleados', requierePermiso('dispositivos_corporativos', 'puede_editar'), controller.habilitarEmpleado);
router.delete('/:id/empleados/:habilitacionId', requierePermiso('dispositivos_corporativos', 'puede_editar'), controller.deshabilitarEmpleado);

module.exports = router;
