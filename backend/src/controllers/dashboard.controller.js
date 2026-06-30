const dashboardService = require('../services/dashboard.service');

async function resumen(req, res, next) {
  try {
    res.json(await dashboardService.resumen(req.query.periodo));
  } catch (err) {
    next(err);
  }
}

async function ranking(req, res, next) {
  try {
    res.json(await dashboardService.ranking(req.query.periodo));
  } catch (err) {
    next(err);
  }
}

module.exports = { resumen, ranking };
