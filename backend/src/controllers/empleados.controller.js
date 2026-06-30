const empleadosService = require('../services/empleados.service');
const dispositivosService = require('../services/dispositivos.service');
const biometriaService = require('../services/biometria.service');

async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true';
    res.json(await empleadosService.listar(incluirInactivos));
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    res.json(await empleadosService.obtenerOFallar(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, apellido, documentoNro, hrmsRef } = req.body;
    res.status(201).json(await empleadosService.crear({ nombre, apellido, documentoNro, hrmsRef }));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, apellido, documentoNro, estado, hrmsRef } = req.body;
    res.json(await empleadosService.actualizar(Number(req.params.id), {
      nombre, apellido, documentoNro, estado, hrmsRef
    }));
  } catch (err) {
    next(err);
  }
}

async function enrolarDispositivo(req, res, next) {
  try {
    const resultado = await dispositivosService.enrolar(Number(req.params.id), req.usuario.id, req.ip);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function obtenerEnlaceDispositivo(req, res, next) {
  try {
    res.json(await dispositivosService.obtenerEnlace(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

async function revocarDispositivo(req, res, next) {
  try {
    await dispositivosService.revocar(
      Number(req.params.dispositivoId),
      Number(req.params.id),
      req.usuario.id,
      req.ip
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function enrolarBiometria(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'foto es requerida (multipart, campo "foto")' });
    const resultado = await biometriaService.enrolar(
      Number(req.params.id),
      req.file.buffer,
      req.file.mimetype,
      req.usuario.id,
      req.ip
    );
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  enrolarDispositivo,
  obtenerEnlaceDispositivo,
  revocarDispositivo,
  enrolarBiometria,
};
