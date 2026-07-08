const visitasService = require('../services/visitas.service');

async function registrar(req, res, next) {
  try {
    const { sucursalId, qrToken, gpsLat, gpsLng } = req.body;
    if (!sucursalId || !qrToken) {
      return res.status(400).json({ error: 'sucursalId y qrToken son requeridos' });
    }
    const visita = await visitasService.registrar({
      empleadoId: req.dispositivo.empleadoId,
      sucursalId: Number(sucursalId),
      qrToken,
      gpsLat: gpsLat != null ? Number(gpsLat) : null,
      gpsLng: gpsLng != null ? Number(gpsLng) : null,
    });
    res.status(201).json(visita);
  } catch (err) {
    next(err);
  }
}

async function resumen(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    res.json(await visitasService.resumen({ fechaInicio, fechaFin }));
  } catch (err) {
    next(err);
  }
}

async function listar(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    res.json(await visitasService.listar({ fechaInicio, fechaFin }));
  } catch (err) {
    next(err);
  }
}

module.exports = { registrar, resumen, listar };
