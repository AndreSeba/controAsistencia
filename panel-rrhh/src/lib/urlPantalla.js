// Base de la PWA: en dev, misma LAN IP que el panel pero puerto 5175 (HTTPS, certificado
// autofirmado); en producción hay que setear VITE_PWA_URL al dominio real de Vercel.
function basePwa() {
  return import.meta.env.VITE_PWA_URL || `https://${window.location.hostname}:5175`;
}

function urlPantalla(sucursalId) {
  return `${basePwa()}/pantalla/${sucursalId}`;
}

// Enlace de activación del empleado: lleva el device_token en la URL, así la PWA lo
// configura sola al abrirlo — si el empleado lo pierde, RRHH reenvía el mismo link.
function urlActivacion(deviceToken) {
  return `${basePwa()}/?token=${deviceToken}`;
}

export { urlPantalla, urlActivacion };
