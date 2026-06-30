const marcacionesService = require('../services/marcaciones.service');
const livenessService = require('../services/liveness.service');
const exportExcelService = require('../services/exportExcel.service');

async function retoLiveness(req, res, next) {
  try {
    const reto = await livenessService.emitirReto(req.dispositivo.empleadoId);
    res.json(reto);
  } catch (err) {
    next(err);
  }
}

async function registrar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'selfie (campo "selfie") es requerida' });
    }
    const { sucursalId, qrToken, livenessNonce, gpsLat, gpsLng, gpsPrecisionM, tipo, offlineMode, timestampOffline } = req.body;
    if (!sucursalId || !qrToken || !livenessNonce) {
      return res.status(400).json({ error: 'sucursalId, qrToken y livenessNonce son requeridos' });
    }
    if (tipo && tipo !== 'ENTRADA' && tipo !== 'SALIDA') {
      return res.status(400).json({ error: 'tipo debe ser ENTRADA o SALIDA' });
    }

    const marcacion = await marcacionesService.registrar({
      empleadoId: req.dispositivo.empleadoId,
      sucursalId: Number(sucursalId),
      deviceToken: req.dispositivo.deviceToken,
      qrToken,
      livenessNonce,
      selfieBuffer: req.file.buffer,
      selfieMimetype: req.file.mimetype,
      gpsLat: gpsLat != null ? Number(gpsLat) : null,
      gpsLng: gpsLng != null ? Number(gpsLng) : null,
      gpsPrecisionM: gpsPrecisionM != null ? Number(gpsPrecisionM) : null,
      tipoSolicitado: tipo || undefined,
      offlineMode: offlineMode === 'true' || offlineMode === true,
      timestampOffline: timestampOffline ? Number(timestampOffline) : undefined,
    });

    res.status(201).json(marcacion);
  } catch (err) {
    next(err);
  }
}

function filtrosDeQuery(query) {
  const { empleadoId, sucursalId, estado, tipo, revisado } = query;
  return {
    empleadoId: empleadoId ? Number(empleadoId) : undefined,
    sucursalId: sucursalId ? Number(sucursalId) : undefined,
    estado,
    tipo,
    revisado: revisado != null ? revisado === 'true' : undefined,
  };
}

async function listar(req, res, next) {
  try {
    res.json(await marcacionesService.listar(filtrosDeQuery(req.query)));
  } catch (err) {
    next(err);
  }
}

async function exportar(req, res, next) {
  try {
    const marcaciones = await marcacionesService.listar(filtrosDeQuery(req.query));

    const buffer = await exportExcelService.generarBuffer('Marcaciones', [
      { header: 'Empleado', key: 'empleado_nombre', width: 22 },
      { header: 'Apellido', key: 'empleado_apellido', width: 22 },
      { header: 'Documento', key: 'empleado_documento_nro', width: 16 },
      { header: 'Sucursal', key: 'sucursal_nombre', width: 22 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Fecha/hora UTC', key: 'timestamp_utc', width: 22 },
      { header: 'Dentro geocerca', key: 'dentro_geocerca', width: 14 },
      { header: 'Identidad verificada', key: 'identidad_verificada', width: 18 },
      { header: 'Atraso (min)', key: 'minutos_atraso', width: 14 },
      { header: 'Anticipación (min)', key: 'minutos_anticipacion', width: 18 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Revisado', key: 'revisado', width: 12 },
    ], marcaciones);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="marcaciones.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function revisar(req, res, next) {
  try {
    const resultado = await marcacionesService.marcarRevisado(Number(req.params.id), req.usuario.id, req.ip);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { retoLiveness, registrar, listar, exportar, revisar };
