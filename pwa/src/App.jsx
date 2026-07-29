import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import ConfigurarDispositivo from './pages/ConfigurarDispositivo';
import Marcar from './pages/Marcar';
import Pantalla from './pages/Pantalla';
import AvisoInstalarIOS from './components/AvisoInstalarIOS';
import { guardarDeviceToken, obtenerDeviceToken } from './lib/dispositivoStore';
import { request } from './lib/api';

function InicioEmpleado() {
  const [deviceToken, setDeviceToken] = useState(undefined);
  const [errorActivacion, setErrorActivacion] = useState(null);

  useEffect(() => {
    // El enlace que RRHH comparte/reenvía lleva ?token=... con un código de
    // ACTIVACIÓN de un solo uso (no el device_token real) — se canjea contra el
    // backend y se limpia de la URL para que no quede visible en el historial del
    // navegador ni pueda reusarse copiando la barra de direcciones.
    const tokenDeUrl = new URLSearchParams(window.location.search).get('token');
    if (tokenDeUrl) {
      request('/empleados/activar-dispositivo', { method: 'POST', body: { activacionToken: tokenDeUrl } })
        .then(({ deviceToken: real }) => guardarDeviceToken(real).then(() => real))
        .then((real) => {
          window.history.replaceState(null, '', window.location.pathname);
          setDeviceToken(real);
        })
        .catch((err) => {
          window.history.replaceState(null, '', window.location.pathname);
          setErrorActivacion(err.message);
          setDeviceToken(null);
        });
      return;
    }
    obtenerDeviceToken().then(setDeviceToken);
  }, []);

  if (deviceToken === undefined) return null;
  return (
    <>
      <AvisoInstalarIOS />
      {!deviceToken
        ? <ConfigurarDispositivo onConfigurado={setDeviceToken} errorInicial={errorActivacion} />
        : <Marcar deviceToken={deviceToken} />}
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioEmpleado />} />
      <Route path="/pantalla/:sucursalId" element={<Pantalla />} />
    </Routes>
  );
}

export default App;
