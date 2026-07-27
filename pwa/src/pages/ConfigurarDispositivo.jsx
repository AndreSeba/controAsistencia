import { useRef, useState } from 'react';
import { guardarDeviceToken } from '../lib/dispositivoStore';
import { request } from '../lib/api';
import { IconGuardar } from '../components/Icons';
import LogoEmpresa from '../components/LogoEmpresa';

function ConfigurarDispositivo({ onConfigurado, errorInicial }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState(errorInicial || null);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    const limpio = token.trim();
    if (!limpio || guardandoRef.current) return;
    guardandoRef.current = true;
    setError(null);
    setGuardando(true);
    try {
      // El código pegado es de un solo uso (mismo canje que el link automático):
      // el backend lo cambia por el device_token real, que recién ahí se guarda.
      const { deviceToken } = await request('/empleados/activar-dispositivo', {
        method: 'POST',
        body: { activacionToken: limpio },
      });
      await guardarDeviceToken(deviceToken);
      onConfigurado(deviceToken);
    } catch (err) {
      setError(err.message || 'No se pudo activar este teléfono con ese código.');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <LogoEmpresa />
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
            <IconGuardar /> {guardando ? 'Guardando…' : 'Activar este teléfono'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ConfigurarDispositivo;
