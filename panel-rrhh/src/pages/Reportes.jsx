import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import GraficoAsistencia from '../components/GraficoAsistencia';

function Reportes() {
  const { request } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('hoy');

  const { datosPaginados: sucPuntualesPag, paginaActiva: pagSP, totalPaginas: totalSP, irPaginaSiguiente: sigSP, irPaginaAnterior: antSP, setPagina: setPagSP } = usePaginacion(ranking?.sucursalesMasPuntuales || [], 10);
  const { datosPaginados: sucAtrasosPag, paginaActiva: pagSA, totalPaginas: totalSA, irPaginaSiguiente: sigSA, irPaginaAnterior: antSA, setPagina: setPagSA } = usePaginacion(ranking?.sucursalesMasAtrasos || [], 10);
  const { datosPaginados: empPuntualesPag, paginaActiva: pagEP, totalPaginas: totalEP, irPaginaSiguiente: sigEP, irPaginaAnterior: antEP, setPagina: setPagEP } = usePaginacion(ranking?.empleadosMasPuntuales || [], 10);
  const { datosPaginados: empAtrasosPag, paginaActiva: pagEA, totalPaginas: totalEA, irPaginaSiguiente: sigEA, irPaginaAnterior: antEA, setPagina: setPagEA } = usePaginacion(ranking?.empleadosMasAtrasos || [], 10);

  async function cargar() {
    setError(null);
    try {
      const [resResumen, resRanking] = await Promise.all([
        request(`/dashboard/resumen?periodo=${periodo}`),
        request(`/dashboard/ranking?periodo=${periodo}`)
      ]);
      setResumen(resResumen);
      setRanking(resRanking);
      setPagSP(1); setPagSA(1); setPagEP(1); setPagEA(1);
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [periodo]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <label className="filtro-inline">
          <span>Período</span>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="historico">Todo el historial</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {resumen && (
        <>
          <div className="kpi-row">
            <div className="card kpi-card">
              <p className="kpi-label">Entradas</p>
              <p className="kpi-valor">{resumen.totalEntradas}</p>
            </div>
            <div className="card kpi-card">
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
                  <p className="error"><strong>{t.requierenRevision}</strong> requieren revisión</p>
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
                <thead>
                  <tr><th>Sucursal</th><th>A tiempo</th><th>Atrasos</th></tr>
                </thead>
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
                <thead>
                  <tr><th>Sucursal</th><th>Atrasos</th><th>A tiempo</th></tr>
                </thead>
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
                <thead>
                  <tr><th>Personal</th><th>A tiempo</th><th>Atrasos</th></tr>
                </thead>
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
                <thead>
                  <tr><th>Personal</th><th>Atrasos</th><th>A tiempo</th></tr>
                </thead>
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

      <button type="button" onClick={cargar}>Actualizar</button>
    </div>
  );
}

export default Reportes;
