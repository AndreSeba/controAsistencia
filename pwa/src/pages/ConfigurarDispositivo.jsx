import { useRef, useState } from 'react';
import { guardarDeviceToken } from '../lib/dispositivoStore';
import { request } from '../lib/api';
import { IconGuardar } from '../components/Icons';
import LogoEmpresa from '../components/LogoEmpresa';

// 2026-07-28: activación manual DESACTIVADA (no borrada, por si se reactiva a futuro).
// Motivo: desde que el panel copia el ENLACE completo (2026-07-18), el código crudo no
// se muestra en ninguna pantalla del flujo de personal — lo único que alguien podía
// pegar acá era el link entero, que el canje rechaza con 404: la caja solo producía
// errores. Y desde que el enlace es reutilizable (2026-07-26), el camino correcto para
// un teléfono sin configurar es simplemente volver a abrir el enlace. Para reactivarla
// haría falta, además de poner esto en true, que el panel vuelva a mostrar el código
// crudo en algún lado.
const PERMITIR_ACTIVACION_MANUAL = false;

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

  if (!PERMITIR_ACTIVACION_MANUAL) {
    // La pantalla sigue siendo la landing de "teléfono sin configurar" y el lugar donde
    // se muestra el error si el canje del enlace (?token=) falló — solo desaparece la
    // caja de pegado manual.
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta">
          <LogoEmpresa />
          <h1>Configurar este teléfono</h1>
          {error && <p className="error">{error}</p>}
          <p className="ayuda">
            Este teléfono todavía no está configurado. Abrí el <strong>enlace de
            activación</strong> que te mandó RRHH — si ya lo abriste en otro navegador,
            el mismo enlace sirve de nuevo desde este.
          </p>
          <p className="ayuda">
            ¿No tenés el enlace? Pedile a RRHH que te lo reenvíe desde el panel
            (Personal → Copiar enlace).
          </p>
        </div>
      </div>
    );
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
