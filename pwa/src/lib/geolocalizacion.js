// La geocerca es señal blanda (ver CLAUDE.md P6): si el GPS falla o el usuario no da
// permiso, la marcación igual se intenta sin coordenadas y el servidor la marca para
// revisión, nunca se bloquea por esto en el cliente.
function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null, precisionM: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precisionM: pos.coords.accuracy,
      }),
      () => resolve({ lat: null, lng: null, precisionM: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

export { obtenerUbicacion };
