import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';

const MESES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_HDR = ['L','M','M','J','V','S','D'];
const POR_PAGINA = 10;

const TIPOS_NOVEDAD = [
  { value: 'baja_medica', label: 'Baja médica',  cls: 'baja_medica' },
  { value: 'permiso',     label: 'Permiso',       cls: 'permiso' },
];

function mesHoy() {
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}
function primerDia(anio, mes) {
  return `${anio}-${String(mes).padStart(2,'0')}-01`;
}
function ultimoDia(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0,10);
}
function diasDelMes(anio, mes) {
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) =>
    `${anio}-${String(mes).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
  );
}
function offsetLunes(anio, mes) {
  return (new Date(Date.UTC(anio, mes-1, 1)).getUTCDay() + 6) % 7;
}
function esFuturo(fechaStr) {
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return fechaStr > hoy;
}
function horaLocal(isoStr) {
  if (!isoStr) return null;
  const local = new Date(new Date(isoStr).getTime() - 4*60*60*1000);
  return `${String(local.getUTCHours()).padStart(2,'0')}:${String(local.getUTCMinutes()).padStart(2,'0')}`;
}
// Sin franco fijo: el personal trabaja los 7 días con 1 día libre variable a la
// semana, así que sábado/domingo no se tratan distinto — el franco de cada quien
// se marca a mano como "Permiso" (novedad), no se asume por calendario.
function estadoDia(jornadas, novedad, fechaStr) {
  if (novedad) return novedad.tipo;
  if (!jornadas?.length) {
    if (esFuturo(fechaStr)) return 'futuro'; // un día que no llegó no es una falta
    return 'falta';
  }
  const max = Math.max(...jornadas.map(j => {
    if (j.requiereRevision || j.cierreAutomatico) return 3;
    if (j.minutosAtraso > 0) return 2;
    return 1;
  }));
  if (max === 3) return 'revision';
  if (max === 2) return 'tarde';
  return 'ok';
}
function tooltipDia(jornadas, novedad, fechaStr) {
  if (novedad) {
    const tipo = TIPOS_NOVEDAD.find(t => t.value === novedad.tipo);
    return `${tipo?.label ?? novedad.tipo}${novedad.nota ? `\n${novedad.nota}` : ''}`;
  }
  if (!jornadas?.length) {
    if (esFuturo(fechaStr)) return fechaStr;
    return 'Sin registro';
  }
  return jornadas.map(j => {
    const entrada = horaLocal(j.horaEntrada) ?? '—';
    const salida  = j.salidaMarcada ? (horaLocal(j.horaSalida) ?? '—') : (j.cierreAutomatico ? 'Auto-cerrada' : '—');
    const extra   = j.minutosAtraso > 0 ? ` (+${j.minutosAtraso}min)` : '';
    return `${j.turnoNombre}: ${entrada}${extra} → ${salida}`;
  }).join('\n');
}

// ── Modal de novedad ────────────────────────────────────────
function ModalNovedad({ info, onGuardar, onEliminar, onCerrar, guardando }) {
  const [tipo, setTipo] = useState(info.novedad?.tipo ?? 'baja_medica');
  const [nota, setNota] = useState(info.novedad?.nota ?? '');

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-caja novedad-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{info.empNombre} — {info.fecha}</span>
          <button type="button" className="modal-cerrar" onClick={onCerrar}>✕</button>
        </div>
        <div className="novedad-opciones">
          {TIPOS_NOVEDAD.map(t => (
            <label key={t.value} className={`novedad-opcion novedad-opcion--${t.cls}${tipo === t.value ? ' activa' : ''}`}>
              <input type="radio" name="tipo" value={t.value} checked={tipo === t.value} onChange={() => setTipo(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
        <textarea
          className="novedad-nota"
          placeholder="Nota opcional (ej: certificado médico Nº 123)"
          value={nota}
          onChange={e => setNota(e.target.value)}
          rows={2}
        />
        <div className="novedad-acciones">
          {info.novedad && (
            <button type="button" className="btn-quitar" onClick={onEliminar} disabled={guardando}>
              Quitar justificación
            </button>
          )}
          <button type="button" onClick={() => onGuardar({ tipo, nota })} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendario de un empleado ───────────────────────────────
function CalendarioMes({ jMap, nMap, dias, offset, onClickFalta }) {
  return (
    <div className="cal-wrapper">
      <div className="cal-hdr">
        {DIAS_HDR.map((d, i) => <span key={i} className="cal-hdr-dia">{d}</span>)}
      </div>
      <div className="cal-grid">
        {Array.from({ length: offset }, (_, i) => <div key={`v${i}`} className="cal-dia cal-dia--vacio" />)}
        {dias.map(fecha => {
          const novedad = nMap[fecha];
          const estado  = estadoDia(jMap[fecha], novedad, fecha);
          const clickeable = estado === 'falta' || estado === 'baja_medica' || estado === 'permiso';
          return (
            <div
              key={fecha}
              className={`cal-dia cal-dia--${estado}${clickeable ? ' cal-dia--clickeable' : ''}`}
              title={tooltipDia(jMap[fecha], novedad, fecha)}
              onClick={clickeable ? () => onClickFalta(fecha, novedad) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Tarjeta de un empleado ──────────────────────────────────
function TarjetaEmpleado({ emp, jMap, nMap, dias, offset, onClickFalta }) {
  const presentes   = dias.filter(d => estadoDia(jMap[d], nMap[d], d) === 'ok').length;
  const tardios     = dias.filter(d => estadoDia(jMap[d], nMap[d], d) === 'tarde').length;
  const revision    = dias.filter(d => estadoDia(jMap[d], nMap[d], d) === 'revision').length;
  const faltas      = dias.filter(d => estadoDia(jMap[d], nMap[d], d) === 'falta').length;
  const bajaMedica  = dias.filter(d => estadoDia(jMap[d], nMap[d], d) === 'baja_medica').length;
  const permisos    = dias.filter(d => estadoDia(jMap[d], nMap[d], d) === 'permiso').length;

  return (
    <div className="card ap-card">
      <div className="ap-header">
        <div>
          <h2 className="ap-nombre">{emp.apellido}, {emp.nombre}</h2>
          {emp.documento_nro && <span className="ayuda">{emp.documento_nro}</span>}
        </div>
        <div className="ap-stats">
          <div className="ap-stat ap-stat--ok"><span className="ap-stat-num">{presentes}</span><span className="ap-stat-lbl">OK</span></div>
          <div className="ap-stat ap-stat--tarde"><span className="ap-stat-num">{tardios}</span><span className="ap-stat-lbl">Tarde</span></div>
          {revision > 0 && <div className="ap-stat ap-stat--revision"><span className="ap-stat-num">{revision}</span><span className="ap-stat-lbl">Rev.</span></div>}
          {bajaMedica > 0 && <div className="ap-stat ap-stat--baja_medica"><span className="ap-stat-num">{bajaMedica}</span><span className="ap-stat-lbl">Baja</span></div>}
          {permisos > 0 && <div className="ap-stat ap-stat--permiso"><span className="ap-stat-num">{permisos}</span><span className="ap-stat-lbl">Perm.</span></div>}
          <div className="ap-stat ap-stat--falta"><span className="ap-stat-num">{faltas}</span><span className="ap-stat-lbl">Faltas</span></div>
        </div>
      </div>
      <CalendarioMes jMap={jMap} nMap={nMap} dias={dias} offset={offset} onClickFalta={onClickFalta} />
    </div>
  );
}

// ── Componente principal ────────────────────────────────────
function AsistenciaPersonal({ empleados }) {
  const { request } = useAuth();
  const [{ anio, mes }, setPeriodo] = useState(mesHoy);
  const [jornadasPorEmp, setJornadasPorEmp] = useState({});
  const [novedadesPorEmp, setNovedadesPorEmp] = useState({});
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [busqueda, setBusqueda]   = useState('');
  const [pagina, setPagina]       = useState(1);
  const [modal, setModal]         = useState(null); // { empId, empNombre, fecha, novedad|null }
  const [guardando, setGuardando] = useState(false);

  const hoy = new Date();
  const esPresente = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;

  async function cargarDatos() {
    if (!empleados.length) return;
    setCargando(true);
    setError(null);
    const params = new URLSearchParams({ fechaInicio: primerDia(anio, mes), fechaFin: ultimoDia(anio, mes) });
    try {
      const [dataJ, dataN] = await Promise.all([
        request(`/dashboard/asistencia?${params}`),
        request(`/novedades?${params}`),
      ]);
      const mJ = {};
      for (const j of dataJ.jornadas) {
        if (!mJ[j.empleadoId]) mJ[j.empleadoId] = {};
        if (!mJ[j.empleadoId][j.fecha]) mJ[j.empleadoId][j.fecha] = [];
        mJ[j.empleadoId][j.fecha].push(j);
      }
      const mN = {};
      for (const n of dataN) {
        if (!mN[n.empleado_id]) mN[n.empleado_id] = {};
        mN[n.empleado_id][n.fecha] = n;
      }
      setJornadasPorEmp(mJ);
      setNovedadesPorEmp(mN);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarDatos(); }, [anio, mes, empleados.length]);

  function navMes(delta) {
    setPeriodo(({ anio: a, mes: m }) => {
      let nm = m + delta, na = a;
      if (nm > 12) { nm = 1; na++; }
      if (nm < 1)  { nm = 12; na--; }
      return { anio: na, mes: nm };
    });
    setPagina(1);
  }

  function abrirModal(empId, empNombre, fecha, novedad) {
    setModal({ empId, empNombre, fecha, novedad: novedad ?? null });
  }

  async function guardarNovedad({ tipo, nota }) {
    setGuardando(true);
    try {
      await request('/novedades', {
        method: 'POST',
        body: { empleadoId: modal.empId, fecha: modal.fecha, tipo, nota },
      });
      setModal(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarNovedad() {
    setGuardando(true);
    try {
      await request(`/novedades/${modal.empId}/${modal.fecha}`, { method: 'DELETE' });
      setModal(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const listaFiltrada = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const base = [...empleados].sort((a, b) => (a.apellido ?? '').localeCompare(b.apellido ?? ''));
    if (!term) return base;
    return base.filter(e => {
      const completo  = `${e.nombre} ${e.apellido}`.toLowerCase();
      const invertido = `${e.apellido} ${e.nombre}`.toLowerCase();
      const doc       = (e.documento_nro ?? '').toLowerCase();
      return completo.includes(term) || invertido.includes(term) || doc.includes(term);
    });
  }, [empleados, busqueda]);

  useEffect(() => { setPagina(1); }, [busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const empPagina    = listaFiltrada.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const dias         = diasDelMes(anio, mes);
  const offset       = offsetLunes(anio, mes);

  return (
    <div>
      <div className="ap-controles">
        <div className="mes-nav">
          <button type="button" onClick={() => navMes(-1)}>◀</button>
          <span className="mes-label">{MESES[mes-1]} {anio}</span>
          <button type="button" onClick={() => navMes(1)} disabled={esPresente}>▶</button>
        </div>
        <input
          type="search"
          className="buscador"
          placeholder="Buscar por nombre, apellido o documento…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {error    && <p className="error">{error}</p>}
      {cargando && <p className="ayuda">Cargando…</p>}
      {!cargando && listaFiltrada.length === 0 && (
        <p className="ayuda">No hay personal que coincida con la búsqueda.</p>
      )}

      <div className="ap-lista">
        {empPagina.map(emp => (
          <TarjetaEmpleado
            key={emp.id}
            emp={emp}
            jMap={jornadasPorEmp[emp.id] ?? {}}
            nMap={novedadesPorEmp[emp.id] ?? {}}
            dias={dias}
            offset={offset}
            onClickFalta={(fecha, novedad) => abrirModal(emp.id, `${emp.apellido}, ${emp.nombre}`, fecha, novedad)}
          />
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="ap-paginacion">
          <button type="button" onClick={() => setPagina(p => Math.max(1, p-1))} disabled={paginaActual <= 1}>◀</button>
          <span>{paginaActual} / {totalPaginas} &nbsp;·&nbsp; {listaFiltrada.length} empleados</span>
          <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas, p+1))} disabled={paginaActual >= totalPaginas}>▶</button>
        </div>
      )}

      <div className="cal-leyenda">
        <span><span className="cal-dot cal-dot--ok" />A tiempo</span>
        <span><span className="cal-dot cal-dot--tarde" />Llegó tarde</span>
        <span><span className="cal-dot cal-dot--revision" />Requiere revisión</span>
        <span><span className="cal-dot cal-dot--falta" />Sin registro</span>
        <span><span className="cal-dot cal-dot--baja_medica" />Baja médica</span>
        <span><span className="cal-dot cal-dot--permiso" />Permiso</span>
      </div>

      {modal && (
        <ModalNovedad
          info={{ empNombre: modal.empNombre, fecha: modal.fecha, novedad: modal.novedad }}
          onGuardar={guardarNovedad}
          onEliminar={eliminarNovedad}
          onCerrar={() => setModal(null)}
          guardando={guardando}
        />
      )}
    </div>
  );
}

export default AsistenciaPersonal;
