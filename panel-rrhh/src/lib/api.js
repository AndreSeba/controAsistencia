// Access token en memoria del módulo (nunca localStorage): inmune a robo por XSS
// vía storage. El refresh token vive en una cookie httpOnly que pone el backend —
// JS nunca la toca, por eso no aparece en ningún lado de este archivo. `credentials:
// 'include'` es lo que hace que el navegador la mande sola en /auth/refresh y /auth/logout.
let accessToken = null;
let refreshPromise = null;

function setAccessToken(token) {
  accessToken = token;
}

function getAccessToken() {
  return accessToken;
}

async function refrescar() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('No se pudo refrescar la sesión');
  return res.json();
}

// Coalesce: si dos requests reciben 401 al mismo tiempo, solo se dispara un refresh.
function refrescarUnaVez() {
  if (!refreshPromise) {
    refreshPromise = refrescar().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, isFormData = false, comoBlob = false, onSesionExpirada } = {}) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && onSesionExpirada) {
    const refrescado = await onSesionExpirada();
    if (refrescado) {
      return request(path, { method, body, isFormData, comoBlob });
    }
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* sin body */ }
    throw new ApiError(data?.error || `Error ${res.status}`, res.status, data);
  }

  if (comoBlob) return res.blob();
  if (res.status === 204) return null;
  return res.json();
}

// Dispara la descarga de un blob (ej. un Excel) como si fuera un link de archivo normal.
function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}

export { setAccessToken, getAccessToken, refrescarUnaVez, request, descargarBlob, ApiError };
