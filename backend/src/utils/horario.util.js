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

// Atribución automática (P5): el turno cuyo hora_inicio de algún bloque esté más
// cercano al timestamp. Devuelve { turno, bloque } — turno es el catálogo, bloque es
// el bloque específico (con hora_inicio/hora_fin).
function atribuirTurno(timestampUtc, catalogos) {
  const minutosActual = minutosDelDiaLocal(timestampUtc);
  let mejorTurno = null;
  let mejorBloque = null;
  let mejorDistancia = Infinity;

  for (const turno of catalogos) {
    const bloques = turno.bloques || [];
    for (const bloque of bloques) {
      const inicioMin = minutosDeHora(bloque.hora_inicio);
      const distancia = Math.min(
        Math.abs(minutosActual - inicioMin),
        1440 - Math.abs(minutosActual - inicioMin)
      );
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia;
        mejorTurno = turno;
        mejorBloque = bloque;
      }
    }
  }
  return mejorTurno ? { turno: mejorTurno, bloque: mejorBloque } : null;
}

// Dado un turno con bloques, encuentra el bloque más cercano al timestamp.
// Usado cuando ya sabemos el turno (por área del empleado) y solo queremos el bloque.
function atribuirBloque(timestampUtc, bloques) {
  if (!bloques || bloques.length === 0) return null;
  if (bloques.length === 1) return bloques[0];

  const minutosActual = minutosDelDiaLocal(timestampUtc);
  let mejor = null;
  let mejorDistancia = Infinity;

  for (const bloque of bloques) {
    const inicioMin = minutosDeHora(bloque.hora_inicio);
    const distancia = Math.min(
      Math.abs(minutosActual - inicioMin),
      1440 - Math.abs(minutosActual - inicioMin)
    );
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = bloque;
    }
  }
  return mejor;
}

// minutos_atraso = floor((timestamp_entrada - hora_inicio_bloque) / 60s), solo si > 0 (P7).
function calcularMinutosAtraso(timestampUtc, bloque) {
  const inicioMin = minutosDeHora(bloque.hora_inicio);
  const diff = minutosDelDiaLocal(timestampUtc) - inicioMin;
  return diff > 0 ? diff : null;
}

// Espejo de calcularMinutosAtraso para el otro sentido: cuántos minutos antes de
// hora_inicio se marcó la entrada (null si no llegó temprano). Señal blanda: se usa
// para flaggear revisión si excede el margen configurado, nunca para bloquear.
function calcularMinutosAnticipacion(timestampUtc, bloque) {
  const inicioMin = minutosDeHora(bloque.hora_inicio);
  const diff = inicioMin - minutosDelDiaLocal(timestampUtc);
  return diff > 0 ? diff : null;
}

// Horario partido: dado el momento de una SALIDA, ¿queda todavía un segundo bloque por
// marcar hoy? Devuelve la hora_inicio del bloque 2 si sí, null si no.
//
// NO usa atribuirBloque a propósito: ese elige el bloque con hora_inicio más CERCANA
// (sirve para el atraso de una entrada), no el bloque que contiene al timestamp. Una
// salida a las 11:50 de un bloque 08:00-12:00 queda a 160 min del bloque 2 (14:30) y a
// 230 min del bloque 1 (08:00), así que atribuirBloque la asigna al bloque 2 — que ni
// empezó. Ese es justo el caso típico (salir a mediodía), así que acá se compara directo
// contra la hora de inicio del segundo bloque.
function bloquePendienteTrasSalida(timestampUtc, bloques) {
  if (!bloques || bloques.length !== 2) return null;
  const inicioBloqueDos = minutosDeHora(bloques[1].hora_inicio);
  return minutosDelDiaLocal(timestampUtc) < inicioBloqueDos ? bloques[1].hora_inicio : null;
}

module.exports = {
  minutosDelDiaLocal,
  minutosDeHora,
  fechaLocal,
  atribuirTurno,
  atribuirBloque,
  calcularMinutosAtraso,
  calcularMinutosAnticipacion,
  bloquePendienteTrasSalida,
};
