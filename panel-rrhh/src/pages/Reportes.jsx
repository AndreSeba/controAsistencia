import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import GraficoAsistencia from '../components/GraficoAsistencia';
import AsistenciaPersonal from '../components/AsistenciaPersonal';
import VisitasSupervisores from '../components/VisitasSupervisores';
import { IconActualizar } from '../components/Icons';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function Reportes() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [vista, setVista] = useState('dashboard');
  const [resumen, setResumen] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState(periodoActual());
  const [fechaDia, setFechaDia] = useState(''); // '' = todo el mes; con valor filtra ese día

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

  function irARevision() {
    navigate('/marcaciones?estado=requiere_revision');
  }

  function manejarTeclaRevision(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      irARevision();
    }
  }

  const { datosPaginados: sucPuntualesPag, paginaActiva: pagSP, totalPaginas: totalSP, irPaginaSiguiente: sigSP, irPaginaAnterior: antSP, setPagina: setPagSP } = usePaginacion(ranking?.sucursalesMasPuntuales || [], 10);
  const { datosPaginados: sucAtrasosPag, paginaActiva: pagSA, totalPaginas: totalSA, irPaginaSiguiente: sigSA, irPaginaAnterior: antSA, setPagina: setPagSA } = usePaginacion(ranking?.sucursalesMasAtrasos || [], 10);
  const { datosPaginados: empPuntualesPag, paginaActiva: pagEP, totalPaginas: totalEP, irPaginaSiguiente: sigEP, irPaginaAnterior: antEP, setPagina: setPagEP } = usePaginacion(ranking?.empleadosMasPuntuales || [], 10);
  const { datosPaginados: empAtrasosPag, paginaActiva: pagEA, totalPaginas: totalEA, irPaginaSiguiente: sigEA, irPaginaAnterior: antEA, setPagina: setPagEA } = usePaginacion(ranking?.empleadosMasAtrasos || [], 10);

  async function cargar() {
    setError(null);
    try {
      const [resResumen, resRanking] = await Promise.all([
        request(`/dashboard/resumen?${filtroFechaQuery}`),
        request(`/dashboard/ranking?${filtroFechaQuery}`)
      ]);
      setResumen(resResumen);
      setRanking(resRanking);
      setPagSP(1); setPagSA(1); setPagEP(1); setPagEA(1);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    request('/empleados').then(setEmpleados).catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [periodo, fechaDia]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reportes</h1>
        {vista === 'dashboard' && (
          <div className="filtros filtros-fila">
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
        )}
      </div>

      <div className="vista-tabs">
        <button
          type="button"
          className={vista === 'dashboard' ? 'active' : ''}
          onClick={() => setVista('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={vista === 'asistencia' ? 'active' : ''}
          onClick={() => setVista('asistencia')}
        >
          Asistencia
        </button>
        <button
          type="button"
          className={vista === 'visitas' ? 'active' : ''}
          onClick={() => setVista('visitas')}
        >
          Visitas
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {vista === 'dashboard' && (
        <>
          {resumen && (
            <>
              <div className="kpi-row">
                <div className="card kpi-card">
                  <p className="kpi-label">Entradas</p>
                  <p className="kpi-valor">{resumen.totalEntradas}</p>
                </div>
                <div
                  className="card kpi-card kpi-card-clicable"
                  onClick={irARevision}
                  onKeyDown={manejarTeclaRevision}
                  role="button"
                  tabIndex={0}
                  title="Ver marcaciones que requieren revisión"
                >
                  <p className="kpi-label">Requieren revisión</p>
                  <p className={`kpi-valor${resumen.totalRequierenRevision > 0 ? ' kpi-alerta' : ''}`}>
                    {resumen.totalRequierenRevision}
                  </p>
                </div>
                <div className="card kpi-card">
                  <p className="kpi-label">Descuentos aplicados</p>
                  <p className="kpi-valor kpi-rojo">
                    {resumen.totalDescuentosGenerales} <span className="kpi-unidad">Bs</span>
                  </p>
                </div>
              </div>

              <div className="tarjetas-turno">
                {resumen.turnos.map((t) => (
                  <div key={t.id} className="card">
                    <h2>{t.nombre}</h2>
                    <p><strong>{t.entradas}</strong> entradas · <strong>{t.salidas}</strong> salidas</p>
                    <p><strong>{t.abiertas}</strong> jornadas abiertas</p>
                    {t.requierenRevision > 0 && (
                      <p
                        className="error texto-clicable"
                        onClick={irARevision}
                        onKeyDown={manejarTeclaRevision}
                        role="button"
                        tabIndex={0}
                        title="Ver marcaciones que requieren revisión"
                      >
                        <strong>{t.requierenRevision}</strong> requieren revisión
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {resumen.descuentosPorSucursal.length > 0 && (
                <div className="card card-descuentos-sucursal">
                  <h2>Descuentos por sucursal</h2>
                  <ul className="lista-simple">
                    {resumen.descuentosPorSucursal.map(ds => (
                      <li key={ds.sucursalId}>
                        <span>{ds.sucursalNombre}</span>
                        <strong>{ds.totalBs} Bs</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {ranking && (
            <div className="seccion">
              <h2 className="seccion-titulo">Ranking de puntualidad</h2>

              <div className="ranking-grid">
                <GraficoAsistencia
                  datos={ranking.sucursalesMasAtrasos.slice(0, 5)}
                  titulo="Top 5 sucursales con más atrasos"
                />
                <GraficoAsistencia
                  datos={ranking.empleadosMasAtrasos.slice(0, 5)}
                  titulo="Top 5 personal con más atrasos"
                />
              </div>

              <div className="ranking-grid">
                <div className="ranking-bloque">
                  <p className="ranking-titulo">Sucursales más puntuales</p>
                  <table className="tabla">
                    <thead><tr><th>Sucursal</th><th>A tiempo</th><th>Atrasos</th></tr></thead>
                    <tbody>
                      {sucPuntualesPag.map(s => (
                        <tr key={s.id}>
                          <td>{s.nombre}</td>
                          <td className="txt-ok"><strong>{s.a_tiempo}</strong></td>
                          <td className="txt-mal">{s.atrasos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ranking-paginacion">
                    <Paginacion paginaActiva={pagSP} totalPaginas={totalSP} irPaginaAnterior={antSP} irPaginaSiguiente={sigSP} />
                  </div>
                </div>

                <div className="ranking-bloque">
                  <p className="ranking-titulo">Sucursales con más atrasos</p>
                  <table className="tabla">
                    <thead><tr><th>Sucursal</th><th>Atrasos</th><th>A tiempo</th></tr></thead>
                    <tbody>
                      {sucAtrasosPag.map(s => (
                        <tr key={s.id}>
                          <td>{s.nombre}</td>
                          <td className="txt-mal"><strong>{s.atrasos}</strong></td>
                          <td className="txt-ok">{s.a_tiempo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ranking-paginacion">
                    <Paginacion paginaActiva={pagSA} totalPaginas={totalSA} irPaginaAnterior={antSA} irPaginaSiguiente={sigSA} />
                  </div>
                </div>

                <div className="ranking-bloque">
                  <p className="ranking-titulo">Personal más puntual</p>
                  <table className="tabla">
                    <thead><tr><th>Personal</th><th>A tiempo</th><th>Atrasos</th></tr></thead>
                    <tbody>
                      {empPuntualesPag.map(e => (
                        <tr key={e.id}>
                          <td>{e.nombre} {e.apellido}</td>
                          <td className="txt-ok"><strong>{e.a_tiempo}</strong></td>
                          <td className="txt-mal">{e.atrasos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ranking-paginacion">
                    <Paginacion paginaActiva={pagEP} totalPaginas={totalEP} irPaginaAnterior={antEP} irPaginaSiguiente={sigEP} />
                  </div>
                </div>

                <div className="ranking-bloque">
                  <p className="ranking-titulo">Personal con más atrasos</p>
                  <table className="tabla">
                    <thead><tr><th>Personal</th><th>Atrasos</th><th>A tiempo</th></tr></thead>
                    <tbody>
                      {empAtrasosPag.map(e => (
                        <tr key={e.id}>
                          <td>{e.nombre} {e.apellido}</td>
                          <td className="txt-mal"><strong>{e.atrasos}</strong></td>
                          <td className="txt-ok">{e.a_tiempo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ranking-paginacion">
                    <Paginacion paginaActiva={pagEA} totalPaginas={totalEA} irPaginaAnterior={antEA} irPaginaSiguiente={sigEA} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={cargar}><IconActualizar /> Actualizar</button>
        </>
      )}

      {vista === 'asistencia' && (
        <AsistenciaPersonal empleados={empleados} />
      )}

      {vista === 'visitas' && (
        <VisitasSupervisores />
      )}
    </div>
  );
}

export default Reportes;
