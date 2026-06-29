import { useState } from 'react';
import { guardarDeviceToken } from '../lib/dispositivoStore';

function ConfigurarDispositivo({ onConfigurado }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    const limpio = token.trim();
    if (!limpio) return;
    setError(null);
    setGuardando(true);
    try {
      await guardarDeviceToken(limpio);
      onConfigurado(limpio);
    } catch {
      setError('No se pudo guardar el código en este dispositivo. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <h1>Configurar este teléfono</h1>
        <p className="ayuda">
          Pedí el código de activación que te dieron al enrolarte. Se ingresa una sola vez.
        </p>
        <form onSubmit={manejarSubmit}>
          <textarea
            placeholder="Pegá aquí tu código de activación"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={3}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Activar este teléfono'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ConfigurarDispositivo;
