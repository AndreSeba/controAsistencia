const dispositivosRepo = require('../repositories/dispositivos.repository');
const dispositivosCorpRepo = require('../repositories/dispositivosCorporativos.repository');

// Identidad del cliente PWA: no hay login JWT para empleados (Modelo A), el
// device_token emitido por RRHH en el enrolamiento es la credencial.
//
// Desde el celular corporativo compartido (reemplaza la propuesta "CI sin celular"),
// un mismo device_token no resuelve a un único empleado: varios pueden estar
// habilitados por RRHH para ese teléfono. En ese caso el body debe traer empleadoId
// (elegido por la persona en la pantalla "¿Quién sos?" de la PWA) y se valida contra
// la habilitación activa antes de continuar — todo lo demás (selfie, liveness,
// face-match) sigue siendo el guardián real de identidad, sin cambios.
async function verificarDispositivo(req, res, next) {
  const deviceToken = req.headers['x-device-token'];
  if (!deviceToken) return res.status(401).json({ error: 'Device token requerido' });

  try {
    const personal = await dispositivosRepo.buscarPorToken(deviceToken);
    if (personal) {
      req.dispositivo = { id: personal.id, empleadoId: personal.empleado_id, deviceToken, compartido: false };
      return next();
    }

    const corporativo = await dispositivosCorpRepo.buscarPorToken(deviceToken);
    if (!corporativo) return res.status(401).json({ error: 'Dispositivo no reconocido o revocado' });

    const empleadoIdSolicitado = Number(req.body?.empleadoId);
    if (!empleadoIdSolicitado) {
      return res.status(400).json({ error: 'empleadoId es requerido para marcar desde un dispositivo corporativo' });
    }

    const habilitacion = await dispositivosCorpRepo.buscarHabilitacion(corporativo.id, empleadoIdSolicitado);
    if (!habilitacion) {
      return res.status(403).json({ error: 'Este empleado no está habilitado para marcar desde este dispositivo' });
    }

    req.dispositivo = {
      id: corporativo.id,
      empleadoId: empleadoIdSolicitado,
      deviceToken,
      compartido: true,
      sucursalId: corporativo.sucursal_id,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Versión liviana usada solo por GET /empleados/yo: identifica el dispositivo SIN
// exigir empleadoId todavía — es lo que la PWA consulta para decidir si mostrar el
// flujo normal o la pantalla "¿Quién sos?" de un dispositivo compartido.
async function identificarDispositivo(req, res, next) {
  const deviceToken = req.headers['x-device-token'];
  if (!deviceToken) return res.status(401).json({ error: 'Device token requerido' });

  try {
    const personal = await dispositivosRepo.buscarPorToken(deviceToken);
    if (personal) {
      req.dispositivoInfo = { compartido: false, empleadoId: personal.empleado_id };
      return next();
    }

    const corporativo = await dispositivosCorpRepo.buscarPorToken(deviceToken);
    if (!corporativo) return res.status(401).json({ error: 'Dispositivo no reconocido o revocado' });

    req.dispositivoInfo = { compartido: true, dispositivoCorporativoId: corporativo.id };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verificarDispositivo, identificarDispositivo };
