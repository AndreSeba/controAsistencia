const dashboardService = require('../services/dashboard.service');

async function resumen(req, res, next) {
  try {
    const { periodo, fecha } = req.query;
    res.json(await dashboardService.resumen({ periodo, fecha }));
  } catch (err) {
    next(err);
  }
}

async function ranking(req, res, next) {
  try {
    const { periodo, fecha } = req.query;
    res.json(await dashboardService.ranking({ periodo, fecha }));
  } catch (err) {
    next(err);
  }
}

async function asistencia(req, res, next) {
  try {
    const { fechaInicio, fechaFin, sucursalId, turnoId, empleadoId } = req.query;
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
    res.json(await dashboardService.asistenciaSemanal({ fechaInicio, fechaFin, sucursalId, turnoId, empleadoId }));
  } catch (err) {
    next(err);
  }
}

module.exports = { resumen, ranking, asistencia };
