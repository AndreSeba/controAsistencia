const descuentosService = require('../services/descuentos.service');
const exportExcelService = require('../services/exportExcel.service');

async function listar(req, res, next) {
  try {
    const { periodo, estado, empleadoId } = req.query;
    const descuentos = await descuentosService.listar({
      periodo,
      estado,
      empleadoId: empleadoId ? Number(empleadoId) : undefined,
    });
    res.json(descuentos);
  } catch (err) {
    next(err);
  }
}

async function reporte(req, res, next) {
  try {
    res.json(await descuentosService.reportePorPeriodo(req.query.periodo));
  } catch (err) {
    next(err);
  }
}

async function avanzar(req, res, next) {
  try {
    const descuento = await descuentosService.avanzarEstado(Number(req.params.id), req.usuario.id, req.ip);
    res.json(descuento);
  } catch (err) {
    next(err);
  }
}

async function exportarReporte(req, res, next) {
  try {
    const { periodo } = req.query;
    const reporteData = await descuentosService.reportePorPeriodo(periodo);

    const buffer = await exportExcelService.generarBuffer('Reporte descuentos', [
      { header: 'Empleado', key: 'empleado_nombre', width: 28 },
      { header: 'Cantidad descuentos', key: 'cantidad_descuentos', width: 20 },
      { header: 'Total Bs', key: 'total_bs', width: 14 },
      { header: 'Aplicado Bs', key: 'total_aplicado_bs', width: 14 },
    ], reporteData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-descuentos-${periodo}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, reporte, avanzar, exportarReporte };
