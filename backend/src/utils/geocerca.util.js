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

function dentroDeGeocerca(latMarcacion, lngMarcacion, latCentro, lngCentro, radioM) {
  if (latMarcacion == null || lngMarcacion == null) return false;
  return distanciaMetros(latMarcacion, lngMarcacion, latCentro, lngCentro) <= radioM;
}

module.exports = { distanciaMetros, dentroDeGeocerca };
