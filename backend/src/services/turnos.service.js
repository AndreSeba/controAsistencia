const turnosRepo = require('../repositories/turnos.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');

const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

class TurnoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// pg devuelve TIME como string 'HH:MM:SS'; el branch Date queda por compatibilidad histórica (mssql).
function minutosDeHora(horaValue) {
  if (horaValue instanceof Date) return horaValue.getUTCHours() * 60 + horaValue.getUTCMinutes();
  const [h, m] = String(horaValue).split(':').map(Number);
  return h * 60 + m;
}

function validarFormato(horaInicio, horaFin) {
  if (!HORA_REGEX.test(horaInicio) || !HORA_REGEX.test(horaFin)) {
    throw new TurnoError('horaInicio y horaFin deben tener formato HH:MM (24hs)');
  }
  // Invariante del catálogo: ningún turno cruza medianoche (ver CLAUDE.md).
  if (minutosDeHora(horaFin) <= minutosDeHora(horaInicio)) {
    throw new TurnoError('horaFin debe ser posterior a horaInicio (ningún turno cruza medianoche)');
  }
}

function seSuperponen(aInicio, aFin, bInicio, bFin) {
  return minutosDeHora(aInicio) < minutosDeHora(bFin) && minutosDeHora(bInicio) < minutosDeHora(aFin);
}

function formatoHHMM(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function formatear(turno) {
  return {
    ...turno,
    hora_inicio: formatoHHMM(minutosDeHora(turno.hora_inicio)),
    hora_fin: formatoHHMM(minutosDeHora(turno.hora_fin)),
  };
}

async function listar() {
  return (await turnosRepo.listarCatalogo()).map(formatear);
}

async function obtenerOFallar(id) {
  const turno = await turnosRepo.obtenerCatalogoPorId(id);
  if (!turno) throw new TurnoError('Turno no encontrado', 404);
  return formatear(turno);
}

async function actualizarHorario(id, { horaInicio, horaFin }, usuarioId, ip) {
  const anterior = await obtenerOFallar(id);
  validarFormato(horaInicio, horaFin);

  const otros = (await turnosRepo.listarCatalogo()).filter((t) => t.id !== id);
  const choque = otros.find((t) => seSuperponen(horaInicio, horaFin, t.hora_inicio, t.hora_fin));
  if (choque) {
    const inicio = formatoHHMM(minutosDeHora(choque.hora_inicio));
    const fin = formatoHHMM(minutosDeHora(choque.hora_fin));
    throw new TurnoError(`Se superpone con el turno ${choque.nombre} (${inicio}-${fin})`);
  }

  await turnosRepo.actualizarHorario(id, { horaInicio, horaFin });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'actualizar_horario_turno',
    tabla: 'turno_catalogo',
    registroId: id,
    ip,
    detalle: {
      anterior: { horaInicio: anterior.hora_inicio, horaFin: anterior.hora_fin },
      nuevo: { horaInicio, horaFin },
    },
  });

  return obtenerOFallar(id);
}

module.exports = { listar, obtenerOFallar, actualizarHorario, TurnoError };
