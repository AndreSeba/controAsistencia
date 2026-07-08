const turnosService = require('../services/turnos.service');

async function listar(req, res, next) {
  try {
    res.json(await turnosService.listar());
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { bloques, aplicaDescuento } = req.body;
    const turno = await turnosService.actualizar(
      Number(req.params.id),
      { bloques, aplicaDescuento },
      req.usuario.id,
      req.ip
    );
    res.json(turno);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, bloques, aplicaDescuento } = req.body;
    res.status(201).json(await turnosService.crear({ nombre, bloques, aplicaDescuento }, req.usuario.id, req.ip));
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    await turnosService.desactivar(Number(req.params.id), req.usuario.id, req.ip);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, actualizar, crear, desactivar };
