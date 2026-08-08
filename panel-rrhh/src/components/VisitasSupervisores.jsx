import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { descargarBlob } from '../lib/api';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import { IconDescargar } from './Icons';

function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function rangoMes(anio, mes) {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const p = (n) => String(n).padStart(2, '0');
  return { inicio: `${anio}-${p(mes)}-01`, fin: `${anio}-${p(mes)}-${p(ultimo)}` };
}

function fechaHoraLocal(isoStr) {
  const d = new Date(isoStr);
  return `${d.toLocaleDateString('es-BO')} ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
}

function horaLocal(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

// fechaLocal ya viene como texto 'YYYY-MM-DD' del backend (evita el corrimiento
// de un día que da parsear un DATE de Postgres como Date de JS en el navegador).
function fechaLocalCorta(fechaLocal) {
  const [a, m, d] = fechaLocal.split('-');
  return `${d}/${m}/${a}`;
}

function duracionTexto(min) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function celdaHora(timestamp, dentroGeocerca, textoVacio) {
  if (!timestamp) return textoVacio;
  const nota = dentroGeocerca === false ? ' (fuera de geocerca)' : '';
  return `${horaLocal(timestamp)}${nota}`;
}

// Agrupa los pares Entrada/Salida por día para mostrar la fecha una sola vez
// por grupo en vez de repetirla en cada fila.
function agruparPorFecha(pares) {
  const mapa = new Map();
  for (const p of pares) {
    if (!mapa.has(p.fecha_local)) mapa.set(p.fecha_local, []);
    mapa.get(p.fecha_local).push(p);
  }
  return Array.from(mapa.entries())
    .map(([fecha_local, filas]) => ({
      fecha_local,
      filas: [...filas].sort((a, b) =>
        new Date(a.entrada_timestamp || a.salida_timestamp) - new Date(b.entrada_timestamp || b.salida_timestamp)
      ),
    }))
    .sort((a, b) => b.fecha_local.localeCompare(a.fecha_local));
}

function VisitasSupervisores() {
  const { request } = useAuth();
  const [periodo, setPeriodo] = useState(periodoActual);
  const [fechaDia, setFechaDia] = useState(''); // '' = todo el mes; con valor filtra ese día
  const [resumen, setResumen] = useState([]);
  const [detalle, setDetalle] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const hoy = periodoActual();
  const [anio, mes] = periodo.split('-').map(Number);

  const { datosPaginados: resPag, paginaActiva: pagR, totalPaginas: totR, irPaginaAnterior: antR, irPaginaSiguiente: sigR, setPagina: setPagR } = usePaginacion(resumen, 10);
  const gruposDetalle = agruparPorFecha(detalle);
  const { datosPaginados: grupPag, paginaActiva: pagD, totalPaginas: totD, irPaginaAnterior: antD, irPaginaSiguiente: sigD, setPagina: setPagD } = usePaginacion(gruposDetalle, 10);

  // El filtro que manda: día exacto si está elegido, si no el mes.
  const { inicio, fin } = fechaDia ? { inicio: fechaDia, fin: fechaDia } : rangoMes(anio, mes);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar mes o día
  useEffect(() => {
    setCargando(true);
    setError(null);
    Promise.all([
      request(`/visitas/resumen?fechaInicio=${inicio}&fechaFin=${fin}`),
      request(`/visitas?fechaInicio=${inicio}&fechaFin=${fin}`),
    ])
      .then(([res, det]) => { setResumen(res); setDetalle(det); setPagR(1); setPagD(1); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [periodo, fechaDia]);

  function manejarCambioMes(valor) {
    if (!valor) return; // el navegador puede mandar vacío al escribir a mano; ignorar
    setPeriodo(valor);
    setFechaDia('');
  }

  async function descargarExcel() {
    setError(null);
    try {
      const blob = await request(`/visitas/export?fechaInicio=${inicio}&fechaFin=${fin}`, { comoBlob: true });
      descargarBlob(blob, 'visitas.xlsx');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="ap-controles">
        <label>
          Mes
          <input type="month" value={periodo} max={hoy} onChange={(e) => manejarCambioMes(e.target.value)} />
        </label>
        <label>
          Día
          <span className="filtro-dia">
            <input type="date" value={fechaDia} onChange={(e) => setFechaDia(e.target.value)} />
            {fechaDia && (
              <button type="button" className="btn-limpiar-dia" onClick={() => setFechaDia('')} title="Ver todo el mes">✕</button>
            )}
          </span>
        </label>
        <button type="button" onClick={descargarExcel}><IconDescargar /> Descargar Excel</button>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="ayuda">Cargando…</p>}

      <div className="card">
        <h2>Visitas por supervisor y sucursal</h2>
        {!cargando && resumen.length === 0 ? (
          <p className="ayuda">Sin visitas registradas este mes. Los supervisores registran su visita escaneando el QR de la sucursal desde su celular.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Supervisor</th><th>Sucursal</th><th>Visitas</th><th>Última visita</th></tr>
            </thead>
            <tbody>
              {resPag.map((r) => (
                <tr key={`${r.empleado_id}-${r.sucursal_id}`}>
                  <td>{r.nombre} {r.apellido}</td>
                  <td>{r.sucursal_nombre}</td>
                  <td><strong>{r.visitas}</strong></td>
                  <td>{fechaHoraLocal(r.ultima_visita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Paginacion paginaActiva={pagR} totalPaginas={totR} irPaginaAnterior={antR} irPaginaSiguiente={sigR} />
      </div>

      {detalle.length > 0 && (
        <div className="card">
          <h2>Detalle de visitas</h2>
          {grupPag.map((g) => (
            <div key={g.fecha_local} className="grupo-fecha">
              <h3 className="grupo-fecha-titulo">{fechaLocalCorta(g.fecha_local)}</h3>
              <table className="tabla">
                <thead>
                  <tr><th>Supervisor</th><th>Sucursal</th><th>Entrada</th><th>Salida</th><th>Duración</th></tr>
                </thead>
                <tbody>
                  {g.filas.map((p) => (
                    <tr key={`${p.empleado_id}-${p.sucursal_id}-${p.entrada_timestamp ?? p.salida_timestamp}`}>
                      <td>{p.nombre} {p.apellido}</td>
                      <td>{p.sucursal_nombre}</td>
                      <td>{celdaHora(p.entrada_timestamp, p.entrada_dentro_geocerca, '—')}</td>
                      <td>{celdaHora(p.salida_timestamp, p.salida_dentro_geocerca, 'Sin marcar')}</td>
                      <td>{duracionTexto(p.duracion_min) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <Paginacion paginaActiva={pagD} totalPaginas={totD} irPaginaAnterior={antD} irPaginaSiguiente={sigD} />
        </div>
      )}
    </div>
  );
}

export default VisitasSupervisores;
