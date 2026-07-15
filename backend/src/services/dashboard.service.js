const turnosRepo = require('../repositories/turnos.repository');
const marcacionesRepo = require('../repositories/marcaciones.repository');
const descuentosRepo = require('../repositories/descuentos.repository');
const horarioUtil = require('../utils/horario.util');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODO_RE = /^\d{4}-\d{2}$/;

class DashboardError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Mismo contrato de filtro que Descuentos/Marcaciones: 'fecha' (YYYY-MM-DD) filtra un día
// exacto, 'periodo' (YYYY-MM) filtra el mes completo. 'fecha' manda si ambos vienen. Sin
// ninguno de los dos, cae al día de hoy (comportamiento histórico del dashboard).
function calcularFechas({ periodo, fecha } = {}) {
  if (fecha) {
    if (!FECHA_RE.test(fecha)) throw new DashboardError('fecha debe tener formato YYYY-MM-DD');
    return { fechaInicio: fecha, fechaFin: fecha };
  }

  if (periodo) {
    if (periodo === 'historico') return { fechaInicio: null, fechaFin: null };
    if (!PERIODO_RE.test(periodo)) throw new DashboardError('periodo debe tener formato YYYY-MM');
    const [anio, mes] = periodo.split('-').map(Number);
    const fechaInicio = `${periodo}-01`;
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const fechaFin = `${periodo}-${String(ultimoDia).padStart(2, '0')}`;
    return { fechaInicio, fechaFin };
  }

  const hoyStr = horarioUtil.fechaLocal(new Date());
  return { fechaInicio: hoyStr, fechaFin: hoyStr };
}

async function resumen(filtro) {
  const { fechaInicio, fechaFin } = calcularFechas(filtro);
  const filas = await turnosRepo.resumenPorPeriodo(fechaInicio, fechaFin);

  const turnos = filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    entradas: Number(f.entradas),
    abiertas: Number(f.abiertas),
    salidas: Number(f.salidas),
    requierenRevision: Number(f.requieren_revision),
  }));

  let tsInicio = null;
  let tsFin = null;
  if (fechaInicio && fechaFin) {
    tsInicio = `${fechaInicio}T00:00:00.000-04:00`;
    tsFin = `${fechaFin}T23:59:59.999-04:00`;
  }

  const filasDescuentos = await descuentosRepo.resumenPorSucursal(tsInicio, tsFin);
  const descuentosPorSucursal = filasDescuentos.map(d => ({
    sucursalId: d.sucursal_id,
    sucursalNombre: d.sucursal_nombre,
    totalBs: Number(d.total_bs)
  }));
  const totalDescuentosGenerales = descuentosPorSucursal.reduce((acc, d) => acc + d.totalBs, 0);

  return {
    rango: fechaInicio && fechaFin ? (fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} a ${fechaFin}`) : 'Histórico',
    turnos,
    totalEntradas: turnos.reduce((acc, t) => acc + t.entradas, 0),
    totalRequierenRevision: turnos.reduce((acc, t) => acc + t.requierenRevision, 0),
    descuentosPorSucursal,
    totalDescuentosGenerales,
  };
}

async function ranking(filtro) {
  const { fechaInicio, fechaFin } = calcularFechas(filtro);
  
  // format dates to timestamps for marcaciones query if provided
  let tsInicio = null;
  let tsFin = null;
  if (fechaInicio && fechaFin) {
    tsInicio = `${fechaInicio}T00:00:00.000-04:00`;
    tsFin = `${fechaFin}T23:59:59.999-04:00`;
  }

  const data = await marcacionesRepo.obtenerRankingAtrasos(tsInicio, tsFin);
  
  // Format numbers and sort
  const sucursales = data.sucursales.map(s => ({
    ...s,
    a_tiempo: Number(s.a_tiempo),
    atrasos: Number(s.atrasos)
  }));
  
  const empleados = data.empleados.map(e => ({
    ...e,
    a_tiempo: Number(e.a_tiempo),
    atrasos: Number(e.atrasos)
  }));

  // Create different sorted lists without slicing, frontend handles pagination
  const sucursalesMasPuntuales = [...sucursales].sort((a, b) => b.a_tiempo - a.a_tiempo);
  const sucursalesMasAtrasos = [...sucursales].sort((a, b) => b.atrasos - a.atrasos);
  
  const empleadosMasPuntuales = [...empleados].sort((a, b) => b.a_tiempo - a.a_tiempo);
  const empleadosMasAtrasos = [...empleados].sort((a, b) => b.atrasos - a.atrasos);

  return {
    sucursalesMasPuntuales,
    sucursalesMasAtrasos,
    empleadosMasPuntuales,
    empleadosMasAtrasos
  };
}

async function asistenciaSemanal({ fechaInicio, fechaFin, sucursalId, turnoId, empleadoId }) {
  const filas = await marcacionesRepo.asistenciaSemanal({ fechaInicio, fechaFin, sucursalId, turnoId, empleadoId });

  // Genera la lista de días calendario entre fechaInicio y fechaFin
  const dias = [];
  const cursor = new Date(fechaInicio + 'T12:00:00Z');
  const fin = new Date(fechaFin + 'T12:00:00Z');
  while (cursor <= fin) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Normaliza filas: convierte tipos de pg (strings de NUMERIC, booleans, etc.)
  const jornadas = filas.map(f => ({
    empleadoId:          f.empleado_id,
    empleadoNombre:      f.empleado_nombre,
    empleadoApellido:    f.empleado_apellido,
    empleadoDocumento:   f.empleado_documento_nro,
    jornadaId:           f.jornada_id,
    fecha:               f.fecha instanceof Date ? f.fecha.toISOString().slice(0, 10) : String(f.fecha),
    turnoId:             f.turno_id,
    turnoNombre:         f.turno_nombre,
    sucursalId:          f.sucursal_id,
    sucursalNombre:      f.sucursal_nombre,
    requiereRevision:    Boolean(f.requiere_revision),
    cierreAutomatico:    Boolean(f.cierre_automatico),
    salidaMarcada:       Boolean(f.salida_marcada),
    jornadaEstado:       f.jornada_estado,
    horaEntrada:         f.hora_entrada ?? null,
    minutosAtraso:       f.minutos_atraso != null ? Number(f.minutos_atraso) : null,
    minutosAnticipacion: f.minutos_anticipacion != null ? Number(f.minutos_anticipacion) : null,
    identidadVerificada: f.identidad_verificada != null ? Boolean(f.identidad_verificada) : null,
    horaSalida:          f.hora_salida ?? null,
  }));

  return { fechaInicio, fechaFin, dias, jornadas };
}

module.exports = { resumen, ranking, asistenciaSemanal };
