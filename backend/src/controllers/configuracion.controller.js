const configuracionService = require('../services/configuracion.service');

async function obtener(req, res, next) {
  try {
    const [margenAnticipacionMin, pagoDiaBs, logoUrl] = await Promise.all([
      configuracionService.obtenerMargenAnticipacion(),
      configuracionService.obtenerPagoDiaBs(),
      configuracionService.obtenerLogoUrl(),
    ]);
    res.json({ margenAnticipacionMin, pagoDiaBs, logoUrl });
  } catch (err) {
    next(err);
  }
}

// Endpoint PÚBLICO (sin JWT): la PWA necesita el logo antes de tener sesión, y el
// empleado nunca se loguea. Solo expone la marca visual — ningún parámetro de negocio.
async function obtenerPublica(req, res, next) {
  try {
    res.json({ logoUrl: await configuracionService.obtenerLogoUrl() });
  } catch (err) {
    next(err);
  }
}

async function subirLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'logo (campo "logo") es requerido' });
    const logoUrl = await configuracionService.actualizarLogo(
      req.file.buffer,
      req.file.mimetype,
      req.usuario.id,
      req.ip
    );
    res.json({ logoUrl });
  } catch (err) {
    next(err);
  }
}

async function quitarLogo(req, res, next) {
  try {
    await configuracionService.quitarLogo(req.usuario.id, req.ip);
    res.status(204).end();
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

module.exports = { obtener, obtenerPublica, actualizar, subirLogo, quitarLogo };
