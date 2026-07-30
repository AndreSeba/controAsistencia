const descuentosService = require('../services/descuentos.service');
const exportExcelService = require('../services/exportExcel.service');

async function listar(req, res, next) {
  try {
    const { periodo, fecha, fechaInicio, fechaFin, estado, empleadoId } = req.query;
    const descuentos = await descuentosService.listar({
      periodo,
      fecha,
      fechaInicio,
      fechaFin,
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
    const { periodo, fecha } = req.query;
    res.json(await descuentosService.reportePorPeriodo({ periodo, fecha }));
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
    const { periodo, fecha } = req.query;
    const reporteData = await descuentosService.reportePorPeriodo({ periodo, fecha });

    const buffer = await exportExcelService.generarBuffer('Reporte descuentos', [
      { header: 'Empleado', key: 'empleado_nombre', width: 28 },
      { header: 'Cantidad descuentos', key: 'cantidad_descuentos', width: 20 },
      { header: 'Total Bs', key: 'total_bs', width: 14 },
      { header: 'Aplicado Bs', key: 'total_aplicado_bs', width: 14 },
    ], reporteData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-descuentos-${fecha || periodo}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function planilla(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    res.json(await descuentosService.planillaQuincenal({ fechaInicio, fechaFin }));
  } catch (err) {
    next(err);
  }
}

async function exportarPlanilla(req, res, next) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const { filas, pagoDiaBs } = await descuentosService.planillaQuincenal({ fechaInicio, fechaFin });

    const buffer = await exportExcelService.generarBuffer(`Planilla ${fechaInicio} a ${fechaFin}`, [
      { header: 'Empleado', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Sucursal', key: 'sucursal_nombre', width: 20 },
      { header: 'Días trabajados', key: 'dias_trabajados', width: 16 },
      { header: `Ganado Bs (${pagoDiaBs}/día)`, key: 'ganado_bs', width: 18 },
      { header: 'Descuentos Bs', key: 'descuentos_bs', width: 16 },
      { header: 'Total Bs', key: 'total_bs', width: 14 },
    ], filas);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="planilla-${fechaInicio}-a-${fechaFin}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function listarReglas(req, res, next) {
  try {
    res.json(await descuentosService.listarReglas());
  } catch (err) {
    next(err);
  }
}

async function actualizarRegla(req, res, next) {
  try {
    const regla = await descuentosService.actualizarRegla(
      Number(req.params.id),
      req.body.monto_bs,
      req.usuario.id,
      req.ip,
    );
    res.json(regla);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, reporte, avanzar, exportarReporte, planilla, exportarPlanilla, listarReglas, actualizarRegla };
