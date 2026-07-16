// Base de la PWA: en dev, mismo host que el panel pero puerto 5175 — el dev server de
// la PWA corre en HTTP plano (http://localhost cuenta como contexto seguro para
// getUserMedia, no se configuró HTTPS ahí), por eso se usa el mismo protocolo que el
// panel en vez de hardcodear https. En producción hay que setear VITE_PWA_URL al
// dominio real de Vercel (siempre HTTPS ahí).
function basePwa() {
  return import.meta.env.VITE_PWA_URL || `${window.location.protocol}//${window.location.hostname}:5175`;
}

// El token de pantalla (?k=) es la credencial del kiosko: sin él, el backend no
// entrega el secreto TOTP. Siempre copiar el enlace completo desde el panel.
function urlPantalla(sucursalId, pantallaToken) {
  return `${basePwa()}/pantalla/${sucursalId}?k=${encodeURIComponent(pantallaToken ?? '')}`;
}

// Enlace de activación del empleado: lleva el device_token en la URL, así la PWA lo
// configura sola al abrirlo — si el empleado lo pierde, RRHH reenvía el mismo link.
function urlActivacion(deviceToken) {
  return `${basePwa()}/?token=${deviceToken}`;
}

export { urlPantalla, urlActivacion };
