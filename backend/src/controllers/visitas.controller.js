const visitasService = require('../services/visitas.service');
const exportExcelService = require('../services/exportExcel.service');
const horarioUtil = require('../utils/horario.util');

async function registrar(req, res, next) {
  try {
    const { sucursalId, qrToken, gpsLat, gpsLng } = req.body;
    if (!sucursalId || !qrToken) {
      return res.status(400).json({ error: 'sucursalId y qrToken son requeridos' });
    }
    const visita = await visitasService.registrar({
      empleadoId: req.dispositivo.empleadoId,
      sucursalId: Number(sucursalId),
      qrToken,
      gpsLat: gpsLat != null ? Number(gpsLat) : null,
      gpsLng: gpsLng != null ? Number(gpsLng) : null,
    });
    res.status(201).json(visita);
  } catch (err) {
    next(err);
  }
}

async function resumen(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    res.json(await visitasService.resumen({ fechaInicio, fechaFin }));
  } catch (err) {
    next(err);
  }
}

async function listar(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    res.json(await visitasService.listar({ fechaInicio, fechaFin }));
  } catch (err) {
    next(err);
  }
}

function horaOTexto(timestamp, textoVacio) {
  if (!timestamp) return textoVacio;
  return horarioUtil.fechaHoraLocalTexto(new Date(timestamp)).hora;
}

function duracionTexto(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// No existía ningún export de visitas — se agrega junto con el fix del conteo (ver
// visitas.service.js). Mismos pares Entrada/Salida que ya arma listar(), en hora local
// (Bolivia), no cruda: mismo criterio que el fix del export de Marcaciones.
async function exportar(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const pares = await visitasService.listar({ fechaInicio, fechaFin });

    const filas = pares.map((p) => ({
      ...p,
      fecha_excel: p.fecha_local.split('-').reverse().join('/'), // YYYY-MM-DD -> DD/MM/YYYY
      entrada_hora: horaOTexto(p.entrada_timestamp, '—'),
      salida_hora: horaOTexto(p.salida_timestamp, 'Sin marcar'),
      duracion_texto: duracionTexto(p.duracion_min),
    }));

    const buffer = await exportExcelService.generarBuffer('Visitas', [
      { header: 'Supervisor', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Sucursal', key: 'sucursal_nombre', width: 22 },
      { header: 'Fecha', key: 'fecha_excel', width: 14 },
      { header: 'Entrada', key: 'entrada_hora', width: 12 },
      { header: 'Salida', key: 'salida_hora', width: 14 },
      { header: 'Duración', key: 'duracion_texto', width: 14 },
    ], filas);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="visitas.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { registrar, resumen, listar, exportar };
