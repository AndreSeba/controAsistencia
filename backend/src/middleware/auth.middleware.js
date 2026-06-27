const jwt = require('jsonwebtoken');

const usuariosRepo = require('../repositories/usuarios.repository');

function verificarAccessToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET);
    req.usuario = { id: payload.sub, rol: payload.rol };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Permisos por rol leídos de la base en cada request (sin excepciones por usuario).
function requierePermiso(modulo, accion = 'puede_ver') {
  return async (req, res, next) => {
    try {
      const usuario = await usuariosRepo.buscarPorId(req.usuario.id);
      if (!usuario || !usuario.activo) {
        return res.status(401).json({ error: 'Usuario inválido' });
      }
      const permisos = await usuariosRepo.obtenerPermisos(usuario.rol_id);
      const permiso = permisos.find((p) => p.modulo === modulo);
      if (!permiso || !permiso[accion]) {
        return res.status(403).json({ error: 'Permiso insuficiente' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { verificarAccessToken, requierePermiso };
