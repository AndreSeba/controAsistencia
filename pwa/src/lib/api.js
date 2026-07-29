class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, deviceToken, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (deviceToken) headers['x-device-token'] = deviceToken;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* sin body */ }
    throw new ApiError(data?.error || `Error ${res.status}`, res.status, data);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ¿La request falló por RED (nunca llegó al servidor) y no por un rechazo del backend?
// fetch rechaza con TypeError en ese caso, pero el TEXTO del mensaje varía por navegador:
// Chrome "Failed to fetch", Safari/iOS "Load failed", Firefox "NetworkError when
// attempting...". Comparar strings (como se hacía antes) dejaba a los iPhone afuera —
// con wifi malo mostraban error en vez de guardar la marcación offline. El TIPO del
// error es la señal estable; un ApiError (respuesta HTTP real) nunca es TypeError.
function esErrorDeRed(err) {
  return !navigator.onLine || err instanceof TypeError;
}

export { request, ApiError, esErrorDeRed };
