import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { descargarBlob } from '../lib/api';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

// ── Sección de tarifas ─────────────────────────────────────
function TarifasAtraso({ request }) {
  const [reglas, setReglas] = useState([]);
  const [montos, setMontos] = useState({});   // { id: valorEditado }
  const [guardando, setGuardando] = useState(false);
  const [errorTarifas, setErrorTarifas] = useState(null);
  const [ok, setOk] = useState(false);

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
            {guardando ? 'Guardando…' : `Guardar${sucias.length > 0 ? ` (${sucias.length} cambio${sucias.length > 1 ? 's' : ''})` : ''}`}
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
  const [reporte, setReporte] = useState([]);
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

  const reporteFiltrado = reporte.filter(r => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    const full = `${r.empleado_nombre} ${r.empleado_apellido}`.toLowerCase();
    return full.includes(term) || r.empleado_documento_nro?.toLowerCase().includes(term);
  });
  
  const descuentosFiltrados = descuentos.filter(d => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    const full = `${d.empleado_nombre} ${d.empleado_apellido}`.toLowerCase();
    return full.includes(term) || d.empleado_documento_nro?.toLowerCase().includes(term);
  });

  const { datosPaginados: repPaginados, paginaActiva: repPag, totalPaginas: repTotal, irPaginaSiguiente: repSig, irPaginaAnterior: repAnt, setPagina: setRepPag } = usePaginacion(reporteFiltrado, 10);
  const { datosPaginados: descPaginados, paginaActiva: descPag, totalPaginas: descTotal, irPaginaSiguiente: descSig, irPaginaAnterior: descAnt, setPagina: setDescPag } = usePaginacion(descuentosFiltrados, 10);

  async function cargar() {
    try {
      const [listaDescuentos, listaReporte] = await Promise.all([
        request(`/descuentos?${filtroFechaQuery}`),
        request(`/descuentos/reporte?${filtroFechaQuery}`),
      ]);
      setDescuentos(listaDescuentos);
      setReporte(listaReporte);
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar filtros, no sincronización de UI
  useEffect(() => {
    cargar();
    setRepPag(1);
    setDescPag(1);
  }, [periodo, fechaDia]);

  const totalPeriodo = reporteFiltrado.reduce((acc, r) => acc + Number(r.total_bs), 0);

  async function descargarExcel() {
    setError(null);
    try {
      const blob = await request(`/descuentos/reporte/export?${filtroFechaQuery}`, { comoBlob: true });
      descargarBlob(blob, `reporte-descuentos-${fechaDia || periodo}.xlsx`);
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
        <h2>Resumen del período</h2>
        <button type="button" onClick={descargarExcel} disabled={reporte.length === 0}>Descargar Excel</button>
        {reporte.length === 0 ? (
          <p className="ayuda">Sin descuentos en este período.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Personal</th><th>Documento</th><th>Cantidad</th><th>Total Bs</th></tr>
            </thead>
            <tbody>
              {repPaginados.map((r) => (
                <tr key={r.empleado_id}>
                  <td>{r.empleado_nombre} {r.empleado_apellido}</td>
                  <td>{r.empleado_documento_nro}</td>
                  <td>{r.cantidad_descuentos}</td>
                  <td>{r.total_bs}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td>
                <td></td>
                <td><strong>{totalPeriodo}</strong></td>
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
