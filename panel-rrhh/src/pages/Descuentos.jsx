import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { descargarBlob } from '../lib/api';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import { IconGuardar, IconDescargar } from '../components/Icons';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

// ── Quincenas de pago: 28 (mes anterior) → 13, y 14 → 27 ───
// Una quincena se identifica por {anio, mes, mitad}: mitad 1 termina el 13 de
// ese mes (arranca el 28 del anterior), mitad 2 va del 14 al 27 del mes.
const pad2 = (n) => String(n).padStart(2, '0');

function quincenaActual() {
  const hoy = new Date();
  const d = hoy.getDate(), m = hoy.getMonth() + 1, a = hoy.getFullYear();
  if (d >= 28) return m === 12 ? { anio: a + 1, mes: 1, mitad: 1 } : { anio: a, mes: m + 1, mitad: 1 };
  if (d <= 13) return { anio: a, mes: m, mitad: 1 };
  return { anio: a, mes: m, mitad: 2 };
}

function rangoQuincena({ anio, mes, mitad }) {
  if (mitad === 1) {
    const pm = mes === 1 ? 12 : mes - 1;
    const pa = mes === 1 ? anio - 1 : anio;
    return { inicio: `${pa}-${pad2(pm)}-28`, fin: `${anio}-${pad2(mes)}-13` };
  }
  return { inicio: `${anio}-${pad2(mes)}-14`, fin: `${anio}-${pad2(mes)}-27` };
}

function etiquetaQuincena(q) {
  if (q.mitad === 1) {
    const pm = q.mes === 1 ? 12 : q.mes - 1;
    return `28 ${MESES[pm - 1].slice(0, 3)} – 13 ${MESES[q.mes - 1].slice(0, 3)} ${q.anio}`;
  }
  return `14 – 27 ${MESES[q.mes - 1].slice(0, 3)} ${q.anio}`;
}

function navQuincena(q, delta) {
  if (delta > 0) {
    if (q.mitad === 1) return { ...q, mitad: 2 };
    return q.mes === 12 ? { anio: q.anio + 1, mes: 1, mitad: 1 } : { anio: q.anio, mes: q.mes + 1, mitad: 1 };
  }
  if (q.mitad === 2) return { ...q, mitad: 1 };
  return q.mes === 1 ? { anio: q.anio - 1, mes: 12, mitad: 2 } : { anio: q.anio, mes: q.mes - 1, mitad: 2 };
}

const mismaQuincena = (a, b) => a.anio === b.anio && a.mes === b.mes && a.mitad === b.mitad;

// ── Sección de tarifas ─────────────────────────────────────
function TarifasAtraso({ request }) {
  const [reglas, setReglas] = useState([]);
  const [montos, setMontos] = useState({});   // { id: valorEditado }
  const [guardando, setGuardando] = useState(false);
  const [errorTarifas, setErrorTarifas] = useState(null);
  const [ok, setOk] = useState(false);
  const guardandoRef = useRef(false);

  const cargarReglas = useCallback(async () => {
    try {
      const data = await request('/descuentos/reglas');
      setReglas(data);
      const init = {};
      data.forEach(r => { init[r.id] = String(r.monto_bs); });
      setMontos(init);
    } catch (err) {
      setErrorTarifas(err.message);
    }
  }, [request]);

  useEffect(() => { cargarReglas(); }, [cargarReglas]);

  const sucias = reglas.filter(r => Number(montos[r.id]) !== Number(r.monto_bs));

  async function guardar() {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorTarifas(null);
    setOk(false);
    try {
      await Promise.all(
        sucias.map(r =>
          request(`/descuentos/reglas/${r.id}`, { method: 'PUT', body: { monto_bs: Number(montos[r.id]) } })
        )
      );
      await cargarReglas();
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch (err) {
      setErrorTarifas(err.message);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  function labelBanda(r) {
    if (r.banda_min === 0) return `0 – ${r.banda_max} min`;
    if (r.banda_max === null) return `Más de ${r.banda_min - 1} min`;
    return `${r.banda_min} – ${r.banda_max} min`;
  }

  return (
    <details className="card tarifas-card">
      <summary className="tarifas-summary">
        <svg className="tarifas-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="tarifas-titulo">Tarifas de atraso</span>
        <span className="tarifas-hint">Ajusta cuánto se descuenta según los minutos de atraso</span>
      </summary>
      <div className="tarifas-contenido">
        {errorTarifas && <p className="error">{errorTarifas}</p>}
        <div className="tarifas-lista">
          {reglas.map(r => {
            const sucia = Number(montos[r.id]) !== Number(r.monto_bs);
            return (
              <label key={r.id} className={`tarifa-fila${sucia ? ' tarifa-fila--sucia' : ''}`}>
                <span className="tarifa-rango">
                  {labelBanda(r)}
                  {r.banda_min === 0 && <span className="tarifa-tag">tolerancia</span>}
                </span>
                <span className="tarifa-monto">
                  <span className="tarifa-bs">Bs</span>
                  <input
                    type="number"
                    className="tarifa-input"
                    min="0"
                    step="0.5"
                    value={montos[r.id] ?? ''}
                    onChange={e => setMontos(prev => ({ ...prev, [r.id]: e.target.value }))}
                  />
                </span>
              </label>
            );
          })}
        </div>
        <div className="tarifas-acciones">
          {ok && <span className="tarifa-ok">✓ Guardado</span>}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || sucias.length === 0}
          >
            <IconGuardar /> {guardando ? 'Guardando…' : `Guardar${sucias.length > 0 ? ` (${sucias.length} cambio${sucias.length > 1 ? 's' : ''})` : ''}`}
          </button>
        </div>
      </div>
    </details>
  );
}

function Descuentos() {
  const { request } = useAuth();
  const [periodo, setPeriodo] = useState(periodoActual());
  const [fechaDia, setFechaDia] = useState(''); // '' = todo el mes; con valor filtra ese día
  const [descuentos, setDescuentos] = useState([]);
  const [quincena, setQuincena] = useState(quincenaActual());
  const [planilla, setPlanilla] = useState({ pagoDiaBs: 10, filas: [] });
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [anio, mes] = periodo.split('-').map(Number);
  const hoy = periodoActual();
  const esMesActual = periodo === hoy;

  function navMes(delta) {
    let nm = mes + delta, na = anio;
    if (nm > 12) { nm = 1; na++; }
    if (nm < 1)  { nm = 12; na--; }
    setPeriodo(`${na}-${String(nm).padStart(2, '0')}`);
    setFechaDia('');
  }

  // El filtro que manda: día exacto si está elegido, si no el mes.
  const filtroFechaQuery = fechaDia ? `fecha=${fechaDia}` : `periodo=${periodo}`;

  const planillaFiltrada = planilla.filas.filter(f => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    const full = `${f.nombre} ${f.apellido}`.toLowerCase();
    return full.includes(term) || f.documento_nro?.toLowerCase().includes(term);
  });

  const descuentosFiltrados = descuentos.filter(d => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    const full = `${d.empleado_nombre} ${d.empleado_apellido}`.toLowerCase();
    return full.includes(term) || d.empleado_documento_nro?.toLowerCase().includes(term);
  });

  const { datosPaginados: repPaginados, paginaActiva: repPag, totalPaginas: repTotal, irPaginaSiguiente: repSig, irPaginaAnterior: repAnt, setPagina: setRepPag } = usePaginacion(planillaFiltrada, 10);
  const { datosPaginados: descPaginados, paginaActiva: descPag, totalPaginas: descTotal, irPaginaSiguiente: descSig, irPaginaAnterior: descAnt, setPagina: setDescPag } = usePaginacion(descuentosFiltrados, 10);

  const rango = rangoQuincena(quincena);

  async function cargarDescuentos() {
    try {
      setDescuentos(await request(`/descuentos?${filtroFechaQuery}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function cargarPlanilla() {
    try {
      setPlanilla(await request(`/descuentos/planilla?fechaInicio=${rango.inicio}&fechaFin=${rango.fin}`));
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar filtros, no sincronización de UI
  useEffect(() => {
    cargarDescuentos();
    setDescPag(1);
  }, [periodo, fechaDia]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar quincena
  useEffect(() => {
    cargarPlanilla();
    setRepPag(1);
  }, [quincena.anio, quincena.mes, quincena.mitad]);

  const totales = planillaFiltrada.reduce(
    (acc, f) => ({
      dias: acc.dias + f.dias_trabajados,
      ganado: acc.ganado + f.ganado_bs,
      descuentos: acc.descuentos + f.descuentos_bs,
      total: acc.total + f.total_bs,
    }),
    { dias: 0, ganado: 0, descuentos: 0, total: 0 }
  );

  async function descargarExcel() {
    setError(null);
    try {
      const blob = await request(`/descuentos/planilla/export?fechaInicio=${rango.inicio}&fechaFin=${rango.fin}`, { comoBlob: true });
      descargarBlob(blob, `planilla-${rango.inicio}-a-${rango.fin}.xlsx`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>Descuentos por atraso</h1>
      <p className="subtitulo">Los descuentos se calculan y aplican automáticamente según los minutos de atraso de cada entrada.</p>
      <TarifasAtraso request={request} />
      {error && <p className="error">{error}</p>}

      <div className="filtros filtros-fila filtros-wrap">
        <input
          type="search"
          className="buscador"
          placeholder="Buscar por nombre o CI..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setRepPag(1);
            setDescPag(1);
          }}
        />
        <div className="mes-nav">
          <button type="button" onClick={() => navMes(-1)}>◀</button>
          <span className="mes-label">{MESES[mes - 1]} {anio}</span>
          <button type="button" onClick={() => navMes(1)} disabled={esMesActual}>▶</button>
        </div>
        <label>
          Día
          <span className="filtro-dia">
            <input type="date" value={fechaDia} onChange={(e) => setFechaDia(e.target.value)} />
            {fechaDia && (
              <button type="button" className="btn-limpiar-dia" onClick={() => setFechaDia('')} title="Ver todo el mes">✕</button>
            )}
          </span>
        </label>
      </div>

      <div className="card">
        <div className="planilla-header">
          <h2>Planilla quincenal</h2>
          <div className="mes-nav">
            <button type="button" onClick={() => setQuincena(navQuincena(quincena, -1))}>◀</button>
            <span className="mes-label">{etiquetaQuincena(quincena)}</span>
            <button
              type="button"
              onClick={() => setQuincena(navQuincena(quincena, 1))}
              disabled={mismaQuincena(quincena, quincenaActual())}
            >▶</button>
          </div>
        </div>
        <p className="subtitulo" style={{ marginTop: 0 }}>
          Cada día trabajado paga {planilla.pagoDiaBs} Bs, llegue tarde o temprano.
          Total = ganado − descuentos por atraso de la quincena.
        </p>
        <button type="button" onClick={descargarExcel} disabled={planilla.filas.length === 0}><IconDescargar /> Descargar Excel</button>
        {planilla.filas.length === 0 ? (
          <p className="ayuda">Sin actividad en esta quincena.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Personal</th><th>Documento</th><th>Días trabajados</th>
                <th>Ganado Bs</th><th>Descuentos Bs</th><th>Total Bs</th>
              </tr>
            </thead>
            <tbody>
              {repPaginados.map((f) => (
                <tr key={f.empleado_id}>
                  <td>{f.nombre} {f.apellido}</td>
                  <td>{f.documento_nro}</td>
                  <td>{f.dias_trabajados}</td>
                  <td>{f.ganado_bs.toFixed(2)}</td>
                  <td>{f.descuentos_bs.toFixed(2)}</td>
                  <td><strong>{f.total_bs.toFixed(2)}</strong></td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td>
                <td><strong>{totales.dias}</strong></td>
                <td><strong>{totales.ganado.toFixed(2)}</strong></td>
                <td><strong>{totales.descuentos.toFixed(2)}</strong></td>
                <td><strong>{totales.total.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        )}
        <Paginacion
          paginaActiva={repPag}
          totalPaginas={repTotal}
          irPaginaAnterior={repAnt}
          irPaginaSiguiente={repSig}
        />
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Personal</th><th>Documento</th><th>Sucursal</th><th>Fecha</th><th>Hora</th>
            <th>Atraso (min)</th><th>Monto Bs</th>
          </tr>
        </thead>
        <tbody>
          {descPaginados.map((d) => {
            const entrada = new Date(d.timestamp_utc);
            return (
              <tr key={d.id} className={d.minutos_atraso > 60 ? 'fila-alerta' : ''}>
                <td>{d.empleado_nombre} {d.empleado_apellido}</td>
                <td>{d.empleado_documento_nro}</td>
                <td>{d.sucursal_nombre}</td>
                <td>{entrada.toLocaleDateString('es-BO')}</td>
                <td>{entrada.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{d.minutos_atraso}</td>
                <td>{d.monto_bs}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginacion 
        paginaActiva={descPag} 
        totalPaginas={descTotal} 
        irPaginaAnterior={descAnt} 
        irPaginaSiguiente={descSig} 
      />
    </div>
  );
}

export default Descuentos;
