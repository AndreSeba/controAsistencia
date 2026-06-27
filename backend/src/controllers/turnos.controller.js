const turnosService = require('../services/turnos.service');

async function listar(req, res, next) {
  try {
    res.json(await turnosService.listar());
  } catch (err) {
    next(err);
  }
}

async function actualizarHorario(req, res, next) {
  try {
    const { horaInicio, horaFin } = req.body;
    const turno = await turnosService.actualizarHorario(
      Number(req.params.id),
      { horaInicio, horaFin },
      req.usuario.id,
      req.ip
    );
    res.json(turno);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, actualizarHorario };
