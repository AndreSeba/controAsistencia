const configuracionService = require('../services/configuracion.service');

async function obtener(req, res, next) {
  try {
    const [margenAnticipacionMin, pagoDiaBs] = await Promise.all([
      configuracionService.obtenerMargenAnticipacion(),
      configuracionService.obtenerPagoDiaBs(),
    ]);
    res.json({ margenAnticipacionMin, pagoDiaBs });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const respuesta = {};
    if (req.body.margenAnticipacionMin !== undefined) {
      respuesta.margenAnticipacionMin = await configuracionService.actualizarMargenAnticipacion(
        Number(req.body.margenAnticipacionMin),
        req.usuario.id,
        req.ip
      );
    }
    if (req.body.pagoDiaBs !== undefined) {
      respuesta.pagoDiaBs = await configuracionService.actualizarPagoDiaBs(
        Number(req.body.pagoDiaBs),
        req.usuario.id,
        req.ip
      );
    }
    res.json(respuesta);
  } catch (err) {
    next(err);
  }
}

module.exports = { obtener, actualizar };
