const novedadService = require('../services/novedad.service');

async function listar(req, res, next) {
  try {
    const { empleadoId, fechaInicio, fechaFin } = req.query;
    res.json(await novedadService.listar({ empleadoId, fechaInicio, fechaFin }));
  } catch (err) { next(err); }
}

async function guardar(req, res, next) {
  try {
    const { empleadoId, fecha, tipo, nota } = req.body;
    const result = await novedadService.guardar({ empleadoId, fecha, tipo, nota, usuarioId: req.usuario.id });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { empleadoId, fecha } = req.params;
    await novedadService.eliminar({ empleadoId, fecha });
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { listar, guardar, eliminar };
