import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { descargarBlob } from '../lib/api';

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

const SIGUIENTE_ACCION = {
  calculado: 'Aprobar',
  aprobado: 'Aplicar',
};

function Descuentos() {
  const { request } = useAuth();
  const [periodo, setPeriodo] = useState(periodoActual());
  const [filtroEstado, setFiltroEstado] = useState('');
  const [descuentos, setDescuentos] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const query = new URLSearchParams({ periodo });
      if (filtroEstado) query.set('estado', filtroEstado);
      const [listaDescuentos, listaReporte] = await Promise.all([
        request(`/descuentos?${query.toString()}`),
        request(`/descuentos/reporte?periodo=${periodo}`),
      ]);
      setDescuentos(listaDescuentos);
      setReporte(listaReporte);
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar filtros, no sincronización de UI
  useEffect(() => { cargar(); }, [periodo, filtroEstado]);

  async function avanzar(id) {
    setError(null);
    try {
      await request(`/descuentos/${id}/avanzar`, { method: 'PUT' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalPeriodo = reporte.reduce((acc, r) => acc + Number(r.total_bs), 0);

  async function descargarExcel() {
    setError(null);
    try {
      const blob = await request(`/descuentos/reporte/export?periodo=${periodo}`, { comoBlob: true });
      descargarBlob(blob, `reporte-descuentos-${periodo}.xlsx`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>Descuentos por atraso</h1>
      <p className="subtitulo">Los montos se calculan solos según los minutos de atraso. Nada se aplica hasta que lo apruebes acá.</p>
      {error && <p className="error">{error}</p>}

      <div className="filtros filtros-fila">
        <label>
          Período
          <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
        <label>
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="calculado">Calculado</option>
            <option value="aprobado">Aprobado</option>
            <option value="aplicado">Aplicado</option>
          </select>
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
              <tr><th>Empleado</th><th>Cantidad</th><th>Total Bs</th><th>Aplicado Bs</th></tr>
            </thead>
            <tbody>
              {reporte.map((r) => (
                <tr key={r.empleado_id}>
                  <td>{r.empleado_nombre}</td>
                  <td>{r.cantidad_descuentos}</td>
                  <td>{r.total_bs}</td>
                  <td>{r.total_aplicado_bs}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td>
                <td><strong>{totalPeriodo}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Empleado</th><th>Sucursal</th><th>Entrada</th><th>Atraso (min)</th>
            <th>Monto Bs</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {descuentos.map((d) => (
            <tr key={d.id} className={d.minutos_atraso > 60 ? 'fila-alerta' : ''}>
              <td>{d.empleado_nombre}</td>
              <td>{d.sucursal_nombre}</td>
              <td>{new Date(d.timestamp_utc).toLocaleString()}</td>
              <td>{d.minutos_atraso}</td>
              <td>{d.monto_bs}</td>
              <td>{d.estado}</td>
              <td>
                {SIGUIENTE_ACCION[d.estado] && (
                  <button type="button" onClick={() => avanzar(d.id)}>{SIGUIENTE_ACCION[d.estado]}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Descuentos;
