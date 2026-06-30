const turnosRepo = require('../repositories/turnos.repository');
const marcacionesRepo = require('../repositories/marcaciones.repository');
const descuentosRepo = require('../repositories/descuentos.repository');
const horarioUtil = require('../utils/horario.util');

function calcularFechas(periodo) {
  const ahora = new Date();
  const hoyStr = horarioUtil.fechaLocal(ahora); // YYYY-MM-DD
  
  if (periodo === 'hoy') {
    return { fechaInicio: hoyStr, fechaFin: hoyStr };
  }
  
  if (periodo === 'semana') {
    // Get local Monday
    const local = new Date(ahora.getTime() - 4 * 60 * 60 * 1000);
    const day = local.getUTCDay() || 7; 
    if (day !== 1) local.setUTCDate(local.getUTCDate() - (day - 1));
    const lunesStr = local.toISOString().slice(0, 10);
    return { fechaInicio: lunesStr, fechaFin: hoyStr };
  }
  
  if (periodo === 'mes') {
    const mesStr = hoyStr.slice(0, 8) + '01'; // YYYY-MM-01
    return { fechaInicio: mesStr, fechaFin: hoyStr };
  }
  
  // 'historico' o default
  return { fechaInicio: null, fechaFin: null };
}

async function resumen(periodo = 'hoy') {
  const { fechaInicio, fechaFin } = calcularFechas(periodo);
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
    periodo,
    rango: fechaInicio && fechaFin ? (fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} a ${fechaFin}`) : 'Histórico',
    turnos,
    totalEntradas: turnos.reduce((acc, t) => acc + t.entradas, 0),
    totalRequierenRevision: turnos.reduce((acc, t) => acc + t.requierenRevision, 0),
    descuentosPorSucursal,
    totalDescuentosGenerales,
  };
}

async function ranking(periodo = 'hoy') {
  const { fechaInicio, fechaFin } = calcularFechas(periodo);
  
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

module.exports = { resumen, ranking };
