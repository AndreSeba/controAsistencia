// La geocerca es señal blanda (ver CLAUDE.md P6): si el GPS falla o el usuario no da
// permiso, la marcación igual se intenta sin coordenadas y el servidor la marca para
// revisión, nunca se bloquea por esto en el cliente.
function pedirPosicion(enableHighAccuracy, timeout) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precisionM: pos.coords.accuracy,
      }),
      reject,
      { enableHighAccuracy, timeout, maximumAge: 0 }
    );
  });
}

// Detectado en producción (2026-07-30): varias marcaciones desde adentro de una oficina
// (sucursal Administración) llegaban con gps_lat/lng en null — no es que el GPS diera una
// ubicación fuera de la geocerca, es que no llegaba a dar ninguna. Alta precisión exige un
// fix satelital real, que adentro de un edificio suele no lograrse en los 8s de margen.
// Fallback: si la alta precisión falla o expira, un segundo intento con baja precisión
// (wifi/antenas, funciona bien en interiores) — menos exacto, pero mucho mejor que nada
// para una señal que de por sí nunca bloquea, solo marca para revisión.
async function obtenerUbicacion() {
  if (!navigator.geolocation) return { lat: null, lng: null, precisionM: null };
  try {
    return await pedirPosicion(true, 8000);
  } catch {
    try {
      return await pedirPosicion(false, 5000);
    } catch {
      return { lat: null, lng: null, precisionM: null };
    }
  }
}

export { obtenerUbicacion };
