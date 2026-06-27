const { getPool } = require('../config/db');

async function buscarPorEmail(email, executor = getPool()) {
  const result = await executor.query(
    `SELECT u.id, u.nombre, u.email, u.password_hash, u.activo,
            u.intentos_fallidos, u.bloqueado_hasta,
            r.id AS rol_id, r.nombre AS rol_nombre
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

async function buscarPorId(usuarioId, executor = getPool()) {
  const result = await executor.query(
    `SELECT u.id, u.nombre, u.email, u.activo, r.id AS rol_id, r.nombre AS rol_nombre
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.id = $1`,
    [usuarioId]
  );
  return result.rows[0] || null;
}

async function registrarIntentoFallido(usuarioId, intentos, bloqueadoHasta, executor = getPool()) {
  await executor.query(
    'UPDATE usuarios SET intentos_fallidos = $1, bloqueado_hasta = $2 WHERE id = $3',
    [intentos, bloqueadoHasta, usuarioId]
  );
}

async function resetearIntentosFallidos(usuarioId, executor = getPool()) {
  await executor.query(
    'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1',
    [usuarioId]
  );
}

async function guardarRefreshToken(usuarioId, tokenHash, expiresAt, executor = getPool()) {
  await executor.query(
    'INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [usuarioId, tokenHash, expiresAt]
  );
}

async function buscarRefreshTokenVigente(tokenHash, executor = getPool()) {
  const result = await executor.query(
    `SELECT id, usuario_id, expires_at, revocado
     FROM refresh_tokens
     WHERE token_hash = $1 AND revocado = FALSE`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function revocarRefreshToken(id, executor = getPool()) {
  await executor.query('UPDATE refresh_tokens SET revocado = TRUE WHERE id = $1', [id]);
}

async function revocarTodosLosRefreshTokens(usuarioId, executor = getPool()) {
  await executor.query('UPDATE refresh_tokens SET revocado = TRUE WHERE usuario_id = $1', [usuarioId]);
}

async function obtenerPermisos(rolId, executor = getPool()) {
  const result = await executor.query(
    'SELECT modulo, puede_ver, puede_editar FROM rol_permisos WHERE rol_id = $1',
    [rolId]
  );
  return result.rows;
}

module.exports = {
  buscarPorEmail,
  buscarPorId,
  registrarIntentoFallido,
  resetearIntentosFallidos,
  guardarRefreshToken,
  buscarRefreshTokenVigente,
  revocarRefreshToken,
  revocarTodosLosRefreshTokens,
  obtenerPermisos,
};
