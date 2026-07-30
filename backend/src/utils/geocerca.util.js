const RADIO_TIERRA_M = 6371000;

// Haversine. La geocerca es señal blanda (P-geocerca): nunca bloquea, solo marca requiere_revision.
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIO_TIERRA_M * c;
}

// Umbral de descarte para lecturas de baja precisión (triangulación por antena de
// celular, sin GPS real): detectado en producción el 2026-07-30, una marcación desde
// adentro de una oficina llegó con gps_precision_m=2000 (2km de margen de error) y
// distancia calculada de 692m — "fuera de geocerca" con un dato que ni el propio
// telefono confiaba. Sin este filtro, cualquiera parado en la sucursal puede aparecer
// lejos por pura imprecisión, no porque se haya movido. Con una lectura así de floja no
// tiene sentido ni intentar la comparación: se trata igual que "sin GPS" (false), que es
// honesto en vez de aparentar una distancia real que no lo es.
const PRECISION_MAXIMA_CONFIABLE_M = 500;

function dentroDeGeocerca(latMarcacion, lngMarcacion, latCentro, lngCentro, radioM, precisionM) {
  if (latMarcacion == null || lngMarcacion == null) return false;
  if (precisionM != null && precisionM > PRECISION_MAXIMA_CONFIABLE_M) return false;
  return distanciaMetros(latMarcacion, lngMarcacion, latCentro, lngCentro) <= radioM;
}

module.exports = { distanciaMetros, dentroDeGeocerca, PRECISION_MAXIMA_CONFIABLE_M };
