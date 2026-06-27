const configuracionService = require('../services/configuracion.service');

async function obtener(req, res, next) {
  try {
    res.json({ margenAnticipacionMin: await configuracionService.obtenerMargenAnticipacion() });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const margenAnticipacionMin = await configuracionService.actualizarMargenAnticipacion(
      Number(req.body.margenAnticipacionMin),
      req.usuario.id,
      req.ip
    );
    res.json({ margenAnticipacionMin });
  } catch (err) {
    next(err);
  }
}

module.exports = { obtener, actualizar };
