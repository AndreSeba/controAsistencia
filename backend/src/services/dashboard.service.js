const turnosRepo = require('../repositories/turnos.repository');
const horarioUtil = require('../utils/horario.util');

async function resumenHoy() {
  const fecha = horarioUtil.fechaLocal(new Date());
  const filas = await turnosRepo.resumenPorFecha(fecha);

  const turnos = filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    entradas: Number(f.entradas),
    abiertas: Number(f.abiertas),
    salidas: Number(f.salidas),
    requierenRevision: Number(f.requieren_revision),
  }));

  return {
    fecha,
    turnos,
    totalEntradas: turnos.reduce((acc, t) => acc + t.entradas, 0),
    totalRequierenRevision: turnos.reduce((acc, t) => acc + t.requierenRevision, 0),
  };
}

module.exports = { resumenHoy };
