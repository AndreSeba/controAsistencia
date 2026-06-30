import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function lunesLocal(offsetSemanas = 0) {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - 4 * 60 * 60 * 1000); // UTC-4 Bolivia
  const dia = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - (dia - 1) + offsetSemanas * 7);
  return local.toISOString().slice(0, 10);
}

function sumarDias(fechaStr, n) {
  const d = new Date(fechaStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function labelDia(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00Z');
  return `${DIAS_ES[d.getUTCDay()]} ${d.getUTCDate()}`;
}

function labelSemana(lunes, viernes) {
  const l = new Date(lunes + 'T12:00:00Z');
  const v = new Date(viernes + 'T12:00:00Z');
  const mismoMes = l.getUTCMonth() === v.getUTCMonth();
  if (mismoMes) {
    return `${l.getUTCDate()} – ${v.getUTCDate()} ${MESES_ES[v.getUTCMonth()]} ${v.getUTCFullYear()}`;
  }
  return `${l.getUTCDate()} ${MESES_ES[l.getUTCMonth()]} – ${v.getUTCDate()} ${MESES_ES[v.getUTCMonth()]} ${v.getUTCFullYear()}`;
}

function horaBolivia(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

function chipData(jornada) {
  if (jornada.requiereRevision) return { tipo: 'revision', label: 'Revisión' };
  if (jornada.cierreAutomatico) return { tipo: 'sin_salida', label: 'Sin salida' };
  if (jornada.minutosAtraso > 0) return { tipo: 'atraso', label: `+${jornada.minutosAtraso} min` };
  return { tipo: 'a_tiempo', label: 'A tiempo' };
}

function Chip({ jornada, onClick }) {
  const { tipo, label } = chipData(jornada);
  return (
    <button
      type="button"
      className={`asistencia-chip asistencia-chip--${tipo}`}
      onClick={() => onClick(jornada)}
      title={`${jornada.turnoNombre} · ${jornada.sucursalNombre}`}
    >
      <span className="chip-turno">{jornada.turnoNombre === 'MAÑANA' ? 'M' : 'T'}</span>
      {label}
    </button>
  );
}

function DetalleJornada({ jornada, onCerrar }) {
  if (!jornada) return null;
  const { tipo, label } = chipData(jornada);
  return (
    <div className="asistencia-detalle">
      <div className="asistencia-detalle-header">
        <div>
          <strong>{jornada.empleadoNombre} {jornada.empleadoApellido}</strong>
          <span className="ayuda"> · {jornada.empleadoDocumento}</span>
        </div>
        <button type="button" className="modal-cerrar" onClick={onCerrar}>✕</button>
      </div>
      <div className="asistencia-detalle-body">
        <div className="detalle-fila"><span>Fecha</span><strong>{jornada.fecha}</strong></div>
        <div className="detalle-fila"><span>Turno</span><strong>{jornada.turnoNombre}</strong></div>
        <div className="detalle-fila"><span>Sucursal</span><strong>{jornada.sucursalNombre}</strong></div>
        <div className="detalle-fila"><span>Estado</span><span className={`asistencia-chip asistencia-chip--${tipo}`}>{label}</span></div>
        <div className="detalle-fila"><span>Entrada</span><strong>{horaBolivia(jornada.horaEntrada)}</strong></div>
        <div className="detalle-fila"><span>Salida</span><strong>{jornada.salidaMarcada ? horaBolivia(jornada.horaSalida) : (jornada.cierreAutomatico ? 'Auto-cerrada' : '—')}</strong></div>
        {jornada.minutosAtraso > 0 && <div className="detalle-fila"><span>Atraso</span><strong className="txt-mal">{jornada.minutosAtraso} min</strong></div>}
        {jornada.minutosAnticipacion > 0 && <div className="detalle-fila"><span>Anticipación</span><strong>{jornada.minutosAnticipacion} min</strong></div>}
        <div className="detalle-fila"><span>Identidad</span><strong className={jornada.identidadVerificada ? 'txt-ok' : 'txt-mal'}>{jornada.identidadVerificada ? 'Verificada' : 'No verificada'}</strong></div>
      </div>
    </div>
  );
}

function AsistenciaSemanal({ sucursales, turnos }) {
  const { request } = useAuth();
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroTurno, setFiltroTurno] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [jornadaDetalle, setJornadaDetalle] = useState(null);

  const lunes = lunesLocal(offsetSemana);
  const viernes = sumarDias(lunes, 4);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fechaInicio: lunes, fechaFin: viernes });
      if (filtroSucursal) params.set('sucursalId', filtroSucursal);
      if (filtroTurno) params.set('turnoId', filtroTurno);
      setDatos(await request(`/dashboard/asistencia?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [offsetSemana, filtroSucursal, filtroTurno]);

  // Índice: empleadoId → { meta, dias: { fecha → [jornadas] } }
  const indice = {};
  if (datos) {
    for (const j of datos.jornadas) {
      if (!indice[j.empleadoId]) {
        indice[j.empleadoId] = {
          id: j.empleadoId,
          nombre: j.empleadoNombre,
          apellido: j.empleadoApellido,
          documento: j.empleadoDocumento,
          dias: {},
        };
      }
      if (!indice[j.empleadoId].dias[j.fecha]) indice[j.empleadoId].dias[j.fecha] = [];
      indice[j.empleadoId].dias[j.fecha].push(j);
    }
  }

  const empleados = Object.values(indice).filter(e => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return `${e.nombre} ${e.apellido}`.toLowerCase().includes(term)
      || e.documento?.toLowerCase().includes(term);
  });

  const dias = datos?.dias ?? [];

  return (
    <div className="seccion">
      <h2 className="seccion-titulo">Asistencia semanal</h2>

      <div className="asistencia-controles">
        <div className="semana-nav">
          <button type="button" onClick={() => setOffsetSemana(o => o - 1)}>◀</button>
          <span className="semana-label">{labelSemana(lunes, viernes)}</span>
          <button type="button" onClick={() => setOffsetSemana(o => o + 1)} disabled={offsetSemana >= 0}>▶</button>
          {offsetSemana !== 0 && (
            <button type="button" className="btn-hoy" onClick={() => setOffsetSemana(0)}>Hoy</button>
          )}
        </div>

        <div className="filtros filtros-fila filtros-wrap">
          <input
            type="search"
            className="buscador"
            placeholder="Buscar por nombre o CI..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <label>
            Sucursal
            <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}>
              <option value="">Todas</option>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <label>
            Turno
            <select value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
              <option value="">Todos</option>
              {turnos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {jornadaDetalle && (
        <DetalleJornada jornada={jornadaDetalle} onCerrar={() => setJornadaDetalle(null)} />
      )}

      <div className="asistencia-tabla-wrapper">
        {cargando ? (
          <p className="ayuda">Cargando...</p>
        ) : empleados.length === 0 ? (
          <p className="ayuda">Sin registros para esta semana.</p>
        ) : (
          <table className="tabla asistencia-tabla">
            <thead>
              <tr>
                <th className="col-empleado">Personal</th>
                {dias.map(d => (
                  <th key={d} className={`col-dia${d === new Date().toISOString().slice(0, 10) ? ' col-hoy' : ''}`}>
                    {labelDia(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empleados.map(e => (
                <tr key={e.id}>
                  <td className="col-empleado">
                    <span className="emp-nombre">{e.apellido}, {e.nombre}</span>
                    <span className="emp-doc">{e.documento}</span>
                  </td>
                  {dias.map(d => (
                    <td key={d} className="col-dia">
                      {e.dias[d]
                        ? e.dias[d].map(j => (
                          <Chip key={j.jornadaId} jornada={j} onClick={setJornadaDetalle} />
                        ))
                        : <span className="chip-vacio">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="asistencia-leyenda">
        <span className="asistencia-chip asistencia-chip--a_tiempo">A tiempo</span>
        <span className="asistencia-chip asistencia-chip--atraso">+N min tarde</span>
        <span className="asistencia-chip asistencia-chip--sin_salida">Sin salida</span>
        <span className="asistencia-chip asistencia-chip--revision">Revisión</span>
        <span className="chip-vacio">— Sin registro</span>
      </div>
    </div>
  );
}

export default AsistenciaSemanal;
