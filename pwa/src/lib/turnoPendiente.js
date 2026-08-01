// Recordatorio local de "te falta el segundo turno de hoy" (horario partido).
//
// Por qué existe: el aviso que muestra la pantalla de confirmación se ve un par de
// segundos, justo cuando el empleado se está yendo a almorzar — y la marcación que
// olvida es 2 o 3 horas después, con la app cerrada. Guardar el pendiente permite
// volver a mostrárselo si abre la PWA en el medio, en vez de darle dos botones iguales
// sin ninguna pista de cuál le toca.
//
// Vive solo en el teléfono (localStorage): es un recordatorio de UI, no un dato de
// negocio. La verdad de si marcó o no la tiene el servidor, siempre.
//
// Atado al EMPLEADO, no al dispositivo: en un celular corporativo compartido (P16) el
// teléfono pasa de mano en mano durante el día, así que una sola clave global le
// mostraría a una persona el pendiente de otra.
const PREFIJO = 'turnoPendiente';

function clave(empleadoId) {
  // En un dispositivo personal el empleado lo resuelve el servidor por device_token, así
  // que no hay id del lado del cliente: el teléfono es de una sola persona igual.
  return `${PREFIJO}:${empleadoId ?? 'personal'}`;
}

// Fecha local del teléfono en YYYY-MM-DD. Solo se usa para descartar el pendiente de un
// día anterior, no para nada que afecte el cálculo de la marcación.
function hoyLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function guardar(empleadoId, horaInicioBloqueDos) {
  try {
    localStorage.setItem(clave(empleadoId), JSON.stringify({ fecha: hoyLocal(), hora: horaInicioBloqueDos }));
  } catch {
    // localStorage lleno o bloqueado (modo privado de algunos navegadores): el aviso es
    // opcional, nunca puede impedir marcar.
  }
}

// Devuelve la hora del segundo bloque si quedó pendiente HOY, o null. Un pendiente de
// ayer se descarta y se limpia solo — si no, alguien que olvidó marcar ayer vería el
// aviso para siempre.
function obtener(empleadoId) {
  try {
    const crudo = localStorage.getItem(clave(empleadoId));
    if (!crudo) return null;
    const { fecha, hora } = JSON.parse(crudo);
    if (fecha !== hoyLocal()) {
      localStorage.removeItem(clave(empleadoId));
      return null;
    }
    return hora ?? null;
  } catch {
    return null;
  }
}

function limpiar(empleadoId) {
  try {
    localStorage.removeItem(clave(empleadoId));
  } catch {
    // ídem guardar: no puede romper el flujo de marcación.
  }
}

export { guardar, obtener, limpiar };
