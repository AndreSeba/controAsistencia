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

export { request, ApiError };
