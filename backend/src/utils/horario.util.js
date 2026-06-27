const OFFSET_BOLIVIA_MIN = -4 * 60; // UTC-4, sin DST

function minutosDelDiaLocal(timestampUtc) {
  const utcMin = timestampUtc.getUTCHours() * 60 + timestampUtc.getUTCMinutes();
  return ((utcMin + OFFSET_BOLIVIA_MIN) % 1440 + 1440) % 1440;
}

// Fecha calendario local (Bolivia) en formato YYYY-MM-DD, para el grano de turno_jornada.
function fechaLocal(timestampUtc) {
  const local = new Date(timestampUtc.getTime() + OFFSET_BOLIVIA_MIN * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

// pg devuelve TIME como string 'HH:MM:SS'; el branch Date queda por compatibilidad histórica (mssql).
function minutosDeHora(horaValue) {
  if (horaValue instanceof Date) {
    return horaValue.getUTCHours() * 60 + horaValue.getUTCMinutes();
  }
  const [h, m] = String(horaValue).split(':').map(Number);
  return h * 60 + m;
}

// Atribución automática (P5): el turno cuyo hora_inicio esté más cercano al timestamp.
function atribuirTurno(timestampUtc, catalogos) {
  const minutosActual = minutosDelDiaLocal(timestampUtc);
  let mejor = null;
  let mejorDistancia = Infinity;
  for (const turno of catalogos) {
    const inicioMin = minutosDeHora(turno.hora_inicio);
    const distancia = Math.min(
      Math.abs(minutosActual - inicioMin),
      1440 - Math.abs(minutosActual - inicioMin)
    );
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = turno;
    }
  }
  return mejor;
}

// minutos_atraso = floor((timestamp_entrada - hora_inicio_turno) / 60s), solo si > 0 (P7).
function calcularMinutosAtraso(timestampUtc, turnoCatalogo) {
  const inicioMin = minutosDeHora(turnoCatalogo.hora_inicio);
  const diff = minutosDelDiaLocal(timestampUtc) - inicioMin;
  return diff > 0 ? diff : null;
}

// Espejo de calcularMinutosAtraso para el otro sentido: cuántos minutos antes de
// hora_inicio se marcó la entrada (null si no llegó temprano). Señal blanda: se usa
// para flaggear revisión si excede el margen configurado, nunca para bloquear.
function calcularMinutosAnticipacion(timestampUtc, turnoCatalogo) {
  const inicioMin = minutosDeHora(turnoCatalogo.hora_inicio);
  const diff = inicioMin - minutosDelDiaLocal(timestampUtc);
  return diff > 0 ? diff : null;
}

module.exports = {
  minutosDelDiaLocal,
  fechaLocal,
  atribuirTurno,
  calcularMinutosAtraso,
  calcularMinutosAnticipacion,
};
