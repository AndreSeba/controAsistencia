const qrTokenService = require('../services/qrToken.service');

async function obtenerVigente(req, res, next) {
  try {
    res.json(await qrTokenService.obtenerVigente(Number(req.params.id), req.query.k));
  } catch (err) {
    next(err);
  }
}

module.exports = { obtenerVigente };
