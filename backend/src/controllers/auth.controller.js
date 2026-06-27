const authService = require('../services/auth.service');

const COOKIE_NOMBRE = 'refreshToken';
const PROD = process.env.NODE_ENV === 'production';

// httpOnly: JS nunca puede leerla (inmune a robo por XSS) — por eso el refresh token
// vive acá y no en localStorage ni en una variable JS, a diferencia del access token.
// path acotado a /api/auth: no se manda en cada request, solo donde se necesita.
// sameSite: 'lax' (no 'none') a propósito: panel/PWA llegan al backend vía rewrite de
// Vercel, así que desde el navegador siempre es mismo origen — 'none' solo ampliaría
// la superficie de CSRF sin necesidad real.
function cookieOpciones() {
  return {
    httpOnly: true,
    secure: PROD,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: authService.ttlRefreshMs(),
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son requeridos' });
    }
    const { accessToken, refreshToken, usuario } = await authService.login(email, password);
    res.cookie(COOKIE_NOMBRE, refreshToken, cookieOpciones());
    res.json({ accessToken, usuario });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NOMBRE];
    const resultado = await authService.refrescar(refreshToken);
    res.cookie(COOKIE_NOMBRE, resultado.refreshToken, cookieOpciones());
    res.json({ accessToken: resultado.accessToken, usuario: resultado.usuario });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NOMBRE];
    await authService.logout(refreshToken);
    res.clearCookie(COOKIE_NOMBRE, { path: '/api/auth' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout };
