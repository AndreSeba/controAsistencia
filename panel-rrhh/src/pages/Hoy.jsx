import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';

function Hoy() {
  const { request } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      setResumen(await request('/dashboard/hoy'));
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  return (
    <div className="page">
      <h1>Hoy</h1>
      {error && <p className="error">{error}</p>}
      {resumen && (
        <>
          <p className="subtitulo">{resumen.fecha} — {resumen.totalEntradas} entradas registradas hoy, {resumen.totalRequierenRevision} para revisar.</p>
          <div className="tarjetas-turno">
            {resumen.turnos.map((t) => (
              <div key={t.id} className="card">
                <h2>{t.nombre}</h2>
                <p><strong>{t.entradas}</strong> entradas</p>
                <p><strong>{t.salidas}</strong> salidas</p>
                <p><strong>{t.abiertas}</strong> jornadas abiertas</p>
                <p>
                  <strong className={t.requierenRevision > 0 ? 'error' : ''}>{t.requierenRevision}</strong> requieren revisión
                </p>
              </div>
            ))}
          </div>
        </>
      )}
      <button type="button" onClick={cargar}>Actualizar</button>
    </div>
  );
}

export default Hoy;
