const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const usuariosRepo = require('../repositories/usuarios.repository');

const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MINUTOS = 15;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function emitirAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol_nombre },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_TTL }
  );
}

function ttlRefreshMs() {
  const match = /^(\d+)d$/.exec(process.env.JWT_REFRESH_TTL);
  const dias = match ? Number(match[1]) : 7;
  return dias * 24 * 60 * 60 * 1000;
}

async function emitirRefreshToken(usuarioId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + ttlRefreshMs());
  await usuariosRepo.guardarRefreshToken(usuarioId, hashToken(token), expiresAt);
  return token;
}

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

async function login(email, password) {
  const usuario = await usuariosRepo.buscarPorEmail(email);
  if (!usuario || !usuario.activo) {
    throw new AuthError('Credenciales inválidas');
  }

  if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
    throw new AuthError('Usuario bloqueado temporalmente por intentos fallidos', 423);
  }

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordOk) {
    const intentos = usuario.intentos_fallidos + 1;
    const bloqueadoHasta =
      intentos >= MAX_INTENTOS_FALLIDOS
        ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000)
        : null;
    await usuariosRepo.registrarIntentoFallido(usuario.id, intentos, bloqueadoHasta);
    throw new AuthError('Credenciales inválidas');
  }

  await usuariosRepo.resetearIntentosFallidos(usuario.id);

  const accessToken = emitirAccessToken(usuario);
  const refreshToken = await emitirRefreshToken(usuario.id);

  return {
    accessToken,
    refreshToken,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol_nombre },
  };
}

async function refrescar(refreshToken) {
  if (!refreshToken) throw new AuthError('Refresh token requerido');

  const registro = await usuariosRepo.buscarRefreshTokenVigente(hashToken(refreshToken));
  if (!registro || new Date(registro.expires_at) < new Date()) {
    throw new AuthError('Refresh token inválido o expirado');
  }

  // Rotación: revocar el viejo, emitir uno nuevo.
  await usuariosRepo.revocarRefreshToken(registro.id);

  const usuario = await usuariosRepo.buscarPorId(registro.usuario_id);
  if (!usuario || !usuario.activo) throw new AuthError('Usuario inválido');

  const nuevoAccessToken = emitirAccessToken(usuario);
  const nuevoRefreshToken = await emitirRefreshToken(registro.usuario_id);

  return {
    accessToken: nuevoAccessToken,
    refreshToken: nuevoRefreshToken,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol_nombre },
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const registro = await usuariosRepo.buscarRefreshTokenVigente(hashToken(refreshToken));
  if (registro) await usuariosRepo.revocarRefreshToken(registro.id);
}

module.exports = { login, refrescar, logout, ttlRefreshMs, AuthError };
