const dispositivosRepo = require('../repositories/dispositivos.repository');

// Identidad del cliente PWA: no hay login JWT para empleados (Modelo A), el
// device_token emitido por RRHH en el enrolamiento es la credencial.
async function verificarDispositivo(req, res, next) {
  const deviceToken = req.headers['x-device-token'];
  if (!deviceToken) return res.status(401).json({ error: 'Device token requerido' });

  try {
    const dispositivo = await dispositivosRepo.buscarPorToken(deviceToken);
    if (!dispositivo) return res.status(401).json({ error: 'Dispositivo no reconocido o revocado' });
    req.dispositivo = { id: dispositivo.id, empleadoId: dispositivo.empleado_id, deviceToken };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verificarDispositivo };
