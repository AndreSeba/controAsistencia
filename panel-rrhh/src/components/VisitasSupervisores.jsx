import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mesHoy() {
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
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

function VisitasSupervisores() {
  const { request } = useAuth();
  const [{ anio, mes }, setPeriodo] = useState(mesHoy);
  const [resumen, setResumen] = useState([]);
  const [detalle, setDetalle] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const hoy = new Date();
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;

  const { datosPaginados: resPag, paginaActiva: pagR, totalPaginas: totR, irPaginaAnterior: antR, irPaginaSiguiente: sigR, setPagina: setPagR } = usePaginacion(resumen, 10);
  const { datosPaginados: detPag, paginaActiva: pagD, totalPaginas: totD, irPaginaAnterior: antD, irPaginaSiguiente: sigD, setPagina: setPagD } = usePaginacion(detalle, 10);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar mes
  useEffect(() => {
    const { inicio, fin } = rangoMes(anio, mes);
    setCargando(true);
    setError(null);
    Promise.all([
      request(`/visitas/resumen?fechaInicio=${inicio}&fechaFin=${fin}`),
      request(`/visitas?fechaInicio=${inicio}&fechaFin=${fin}`),
    ])
      .then(([res, det]) => { setResumen(res); setDetalle(det); setPagR(1); setPagD(1); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [anio, mes]);

  function navMes(delta) {
    setPeriodo(({ anio: a, mes: m }) => {
      let nm = m + delta, na = a;
      if (nm > 12) { nm = 1; na++; }
      if (nm < 1)  { nm = 12; na--; }
      return { anio: na, mes: nm };
    });
  }

  return (
    <div>
      <div className="ap-controles">
        <div className="mes-nav">
          <button type="button" onClick={() => navMes(-1)}>◀</button>
          <span className="mes-label">{MESES[mes - 1]} {anio}</span>
          <button type="button" onClick={() => navMes(1)} disabled={esMesActual}>▶</button>
        </div>
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
          <table className="tabla">
            <thead>
              <tr><th>Supervisor</th><th>Sucursal</th><th>Fecha y hora</th><th>En la sucursal</th></tr>
            </thead>
            <tbody>
              {detPag.map((v) => (
                <tr key={v.id}>
                  <td>{v.nombre} {v.apellido}</td>
                  <td>{v.sucursal_nombre}</td>
                  <td>{fechaHoraLocal(v.timestamp_utc)}</td>
                  <td>{v.dentro_geocerca == null ? 'Sin GPS' : v.dentro_geocerca ? 'Sí' : 'Fuera de geocerca'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginacion paginaActiva={pagD} totalPaginas={totD} irPaginaAnterior={antD} irPaginaSiguiente={sigD} />
        </div>
      )}
    </div>
  );
}

export default VisitasSupervisores;
