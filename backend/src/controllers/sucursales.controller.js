const sucursalesService = require('../services/sucursales.service');

async function listar(req, res, next) {
  try {
    const incluirInactivas = req.query.incluirInactivas === 'true';
    res.json(await sucursalesService.listar(incluirInactivas));
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    res.json(await sucursalesService.obtenerOFallar(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, geoLat, geoLng, geoRadioM, wifiBssid } = req.body;
    const sucursal = await sucursalesService.crear(
      { nombre, geoLat, geoLng, geoRadioM, wifiBssid },
      req.usuario.id,
      req.ip
    );
    res.status(201).json(sucursal);
  } catch (err) {
    next(err);
  }
}

async function actualizarDatos(req, res, next) {
  try {
    const { nombre, activo } = req.body;
    const sucursal = await sucursalesService.actualizarDatos(Number(req.params.id), { nombre, activo });
    res.json(sucursal);
  } catch (err) {
    next(err);
  }
}

async function actualizarGeocerca(req, res, next) {
  try {
    const { geoLat, geoLng, geoRadioM, wifiBssid } = req.body;
    const sucursal = await sucursalesService.actualizarGeocerca(
      Number(req.params.id),
      { geoLat, geoLng, geoRadioM, wifiBssid },
      req.usuario.id,
      req.ip
    );
    res.json(sucursal);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizarDatos, actualizarGeocerca };
