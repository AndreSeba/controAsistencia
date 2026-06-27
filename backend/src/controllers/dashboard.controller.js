const dashboardService = require('../services/dashboard.service');

async function hoy(req, res, next) {
  try {
    res.json(await dashboardService.resumenHoy());
  } catch (err) {
    next(err);
  }
}

module.exports = { hoy };
