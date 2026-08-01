const empleadosService = require('../services/empleados.service');
const dispositivosService = require('../services/dispositivos.service');
const dispositivosCorpService = require('../services/dispositivosCorporativos.service');
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
    const { nombre, apellido, documentoNro, hrmsRef, areaTurnoId, telefono, esSupervisor, fechaIngreso, fechaRetiro } = req.body;
    res.status(201).json(await empleadosService.crear({
      nombre, apellido, documentoNro, hrmsRef, areaTurnoId, telefono, esSupervisor, fechaIngreso, fechaRetiro
    }));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, apellido, documentoNro, estado, hrmsRef, areaTurnoId, telefono, esSupervisor, fechaIngreso, fechaRetiro } = req.body;
    res.json(await empleadosService.actualizar(Number(req.params.id), {
      nombre, apellido, documentoNro, estado, hrmsRef, areaTurnoId, telefono, esSupervisor, fechaIngreso, fechaRetiro
    }));
  } catch (err) {
    next(err);
  }
}

// Perfil mínimo del dueño del device token (PWA): decide si mostrar el botón de
// "Registrar visita" (solo supervisores) y, para un celular corporativo compartido,
// devuelve la lista de empleados habilitados en vez de un único perfil — la PWA la usa
// para la pantalla "¿Quién sos?" antes de dejar elegir Entrada/Salida.
async function yo(req, res, next) {
  try {
    if (req.dispositivoInfo.compartido) {
      const empleados = await dispositivosCorpService.listarEmpleadosHabilitados(req.dispositivoInfo.dispositivoCorporativoId);
      return res.json({
        compartido: true,
        empleados: empleados.map(e => ({
          id: e.empleado_id,
          nombre: e.nombre,
          apellido: e.apellido,
          esSupervisor: e.es_supervisor === true,
          fotoReferenciaUrl: e.foto_referencia_url,
          requiereSalida: e.requiere_salida !== false,
        })),
      });
    }
    const emp = await empleadosService.obtenerOFallar(req.dispositivoInfo.empleadoId);
    res.json({
      compartido: false,
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido,
      esSupervisor: emp.es_supervisor === true,
      requiereSalida: emp.requiere_salida !== false,
    });
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

// PWA: canjea el código de activación de un solo uso por el device_token real. Sin
// JWT ni device_token todavía — es el paso previo a tener cualquiera de los dos.
async function activarDispositivo(req, res, next) {
  try {
    const { activacionToken } = req.body;
    if (!activacionToken) return res.status(400).json({ error: 'activacionToken es requerido' });
    res.json(await dispositivosService.activarPorToken(activacionToken));
  } catch (err) {
    next(err);
  }
}

// PWA: auto-activación con link genérico (CI + selfie comparada contra la biometría ya
// enrolada). Sin JWT ni device_token — es, junto con activarDispositivo, el otro camino
// para conseguir uno.
async function autoActivarDispositivo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'selfie (campo "selfie") es requerida' });
    const { documentoNro } = req.body;
    const resultado = await dispositivosService.autoActivar({
      documentoNro,
      selfieBuffer: req.file.buffer,
      ip: req.ip,
    });
    res.json(resultado);
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
  yo,
  enrolarDispositivo,
  obtenerEnlaceDispositivo,
  revocarDispositivo,
  activarDispositivo,
  autoActivarDispositivo,
  enrolarBiometria,
};
