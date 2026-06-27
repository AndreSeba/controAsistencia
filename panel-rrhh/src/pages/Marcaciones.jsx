import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { descargarBlob } from '../lib/api';

function Marcaciones() {
  const { request } = useAuth();
  const [marcaciones, setMarcaciones] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');

  function construirQuery() {
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (filtroTipo) params.set('tipo', filtroTipo);
    if (filtroSucursal) params.set('sucursalId', filtroSucursal);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  async function cargar() {
    try {
      const [listaMarcaciones, listaSucursales] = await Promise.all([
        request(`/marcaciones${construirQuery()}`),
        sucursales.length ? Promise.resolve(sucursales) : request('/sucursales'),
      ]);
      setMarcaciones(listaMarcaciones);
      setSucursales(listaSucursales);
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar cualquier filtro, no sincronización de UI
  useEffect(() => { cargar(); }, [filtroEstado, filtroTipo, filtroSucursal]);

  async function descargarExcel() {
    setError(null);
    try {
      const blob = await request(`/marcaciones/export${construirQuery()}`, { comoBlob: true });
      descargarBlob(blob, 'marcaciones.xlsx');
    } catch (err) {
      setError(err.message);
    }
  }

  async function marcarRevisada(id) {
    setError(null);
    try {
      await request(`/marcaciones/${id}/revisar`, { method: 'PUT' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>Marcaciones</h1>
      {error && <p className="error">{error}</p>}

      <div className="filtros filtros-fila">
        <label>
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todas</option>
            <option value="registrada">Registrada</option>
            <option value="requiere_revision">Requiere revisión</option>
          </select>
        </label>
        <label>
          Tipo
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SALIDA">Salida</option>
          </select>
        </label>
        <label>
          Sucursal
          <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
            <option value="">Todas</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={descargarExcel}>Descargar Excel</button>
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Selfie</th><th>Nombre</th><th>Apellido</th><th>Documento</th><th>Sucursal</th>
            <th>Tipo</th><th>Fecha/hora UTC</th><th>Geocerca</th><th>Identidad</th>
            <th>Atraso (min)</th><th>Anticipación (min)</th><th>Estado</th><th>Revisión</th>
          </tr>
        </thead>
        <tbody>
          {marcaciones.map((m) => (
            <tr key={m.id} className={m.estado === 'requiere_revision' && !m.revisado ? 'fila-alerta' : ''}>
              <td><img className="selfie-miniatura" src={m.selfie_url} alt="selfie" /></td>
              <td>{m.empleado_nombre}</td>
              <td>{m.empleado_apellido}</td>
              <td>{m.empleado_documento_nro}</td>
              <td>{m.sucursal_nombre}</td>
              <td>{m.tipo}</td>
              <td>{new Date(m.timestamp_utc).toLocaleString()}</td>
              <td>{m.dentro_geocerca ? 'Dentro' : 'Fuera'}</td>
              <td>{m.identidad_verificada ? `OK (${m.face_match_score})` : 'No verificada'}</td>
              <td>{m.minutos_atraso ?? '—'}</td>
              <td>{m.minutos_anticipacion ?? '—'}</td>
              <td>{m.estado}</td>
              <td>
                {m.estado !== 'requiere_revision' ? (
                  '—'
                ) : m.revisado ? (
                  `Revisada (${m.revisado_por_nombre})`
                ) : (
                  <button type="button" onClick={() => marcarRevisada(m.id)}>Marcar revisada</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Marcaciones;
