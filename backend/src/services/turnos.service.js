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

function validarBloques(bloques) {
  if (!Array.isArray(bloques) || bloques.length === 0) {
    throw new TurnoError('Se requiere al menos un bloque horario');
  }

  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (!HORA_REGEX.test(b.horaInicio) || !HORA_REGEX.test(b.horaFin)) {
      throw new TurnoError(`Bloque ${i + 1}: horaInicio y horaFin deben tener formato HH:MM (24hs)`);
    }
    if (minutosDeHora(b.horaFin) <= minutosDeHora(b.horaInicio)) {
      throw new TurnoError(`Bloque ${i + 1}: horaFin debe ser posterior a horaInicio (ningún bloque cruza medianoche)`);
    }
  }

  // Verificar orden cronológico y que no se solapen.
  for (let i = 1; i < bloques.length; i++) {
    const finAnterior = minutosDeHora(bloques[i - 1].horaFin);
    const inicioActual = minutosDeHora(bloques[i].horaInicio);
    if (inicioActual <= finAnterior) {
      throw new TurnoError(`Bloque ${i + 1} se solapa o no sigue al bloque ${i}. El inicio (${bloques[i].horaInicio}) debe ser posterior al fin del bloque anterior (${bloques[i - 1].horaFin}).`);
    }
  }
}

function formatoHHMM(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function formatear(turno) {
  return {
    ...turno,
    bloques: (turno.bloques || []).map((b) => ({
      ...b,
      hora_inicio: formatoHHMM(minutosDeHora(b.hora_inicio)),
      hora_fin: formatoHHMM(minutosDeHora(b.hora_fin)),
    })),
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

// Nota: se eliminó la restricción de no-superposición entre turnos. Con el modelo
// de áreas (cada empleado tiene SU área con horario propio), dos áreas pueden
// compartir horario total o parcialmente (Cocina 8-16, Reparto 9-17) sin ambigüedad:
// el atraso se calcula contra el área del empleado, no contra el turno más cercano.
async function actualizar(id, { nombre, bloques, aplicaDescuento }, usuarioId, ip) {
  if (!nombre?.trim()) throw new TurnoError('nombre del área es requerido');
  if (nombre.trim().length > 20) throw new TurnoError('nombre del área: máximo 20 caracteres');
  const anterior = await obtenerOFallar(id);
  validarBloques(bloques);

  const descuentoFlag = aplicaDescuento !== false;
  await turnosRepo.actualizar(id, { nombre: nombre.trim(), bloques, aplicaDescuento: descuentoFlag });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'actualizar_area',
    tabla: 'turno_catalogo',
    registroId: id,
    ip,
    detalle: {
      anterior: { nombre: anterior.nombre, bloques: anterior.bloques, aplica_descuento: anterior.aplica_descuento },
      nuevo: { nombre: nombre.trim(), bloques, aplica_descuento: descuentoFlag },
    },
  });

  return obtenerOFallar(id);
}

async function crear({ nombre, bloques, aplicaDescuento }, usuarioId, ip) {
  if (!nombre?.trim()) throw new TurnoError('nombre del área es requerido');
  if (nombre.trim().length > 20) throw new TurnoError('nombre del área: máximo 20 caracteres');
  validarBloques(bloques);

  const descuentoFlag = aplicaDescuento !== false;
  const id = await turnosRepo.crearCatalogo({ nombre: nombre.trim(), bloques, aplicaDescuento: descuentoFlag });

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'crear_area',
    tabla: 'turno_catalogo',
    registroId: id,
    ip,
    detalle: { nombre: nombre.trim(), bloques, aplica_descuento: descuentoFlag },
  });

  return obtenerOFallar(id);
}

async function desactivar(id, usuarioId, ip) {
  const area = await obtenerOFallar(id);

  const asignados = await turnosRepo.contarEmpleadosAsignados(id);
  if (asignados > 0) {
    throw new TurnoError(
      `No se puede eliminar: hay ${asignados} empleado(s) activo(s) asignados a esta área. Reasignalos primero.`,
      409
    );
  }

  await turnosRepo.desactivarCatalogo(id);

  await auditoriaRepo.registrar({
    usuarioId,
    accion: 'desactivar_area',
    tabla: 'turno_catalogo',
    registroId: id,
    ip,
    detalle: { nombre: area.nombre },
  });
}

module.exports = { listar, obtenerOFallar, actualizar, crear, desactivar, TurnoError };
