const dispositivosCorpService = require('../services/dispositivosCorporativos.service');

async function listar(req, res, next) {
  try {
    res.json(await dispositivosCorpService.listar());
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { sucursalId, nombre } = req.body;
    if (!sucursalId) return res.status(400).json({ error: 'sucursalId es requerido' });
    const resultado = await dispositivosCorpService.crear({ sucursalId: Number(sucursalId), nombre }, req.usuario.id, req.ip);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function obtenerEnlace(req, res, next) {
  try {
    res.json(await dispositivosCorpService.obtenerEnlace(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

async function reasignarSucursal(req, res, next) {
  try {
    const { sucursalId } = req.body;
    if (!sucursalId) return res.status(400).json({ error: 'sucursalId es requerido' });
    const resultado = await dispositivosCorpService.reasignarSucursal(
      Number(req.params.id), { sucursalId: Number(sucursalId) }, req.usuario.id, req.ip
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function revocar(req, res, next) {
  try {
    await dispositivosCorpService.revocar(Number(req.params.id), req.usuario.id, req.ip);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function listarEmpleadosHabilitados(req, res, next) {
  try {
    const empleados = await dispositivosCorpService.listarEmpleadosHabilitados(Number(req.params.id));
    res.json(empleados);
  } catch (err) {
    next(err);
  }
}

async function habilitarEmpleado(req, res, next) {
  try {
    const { empleadoId } = req.body;
    if (!empleadoId) return res.status(400).json({ error: 'empleadoId es requerido' });
    const resultado = await dispositivosCorpService.habilitarEmpleado(
      Number(req.params.id), Number(empleadoId), req.usuario.id, req.ip
    );
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function deshabilitarEmpleado(req, res, next) {
  try {
    await dispositivosCorpService.deshabilitarEmpleado(Number(req.params.habilitacionId), req.usuario.id, req.ip);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  crear,
  obtenerEnlace,
  reasignarSucursal,
  revocar,
  listarEmpleadosHabilitados,
  habilitarEmpleado,
  deshabilitarEmpleado,
};
