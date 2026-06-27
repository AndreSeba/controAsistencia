import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import ConfigurarDispositivo from './pages/ConfigurarDispositivo';
import Marcar from './pages/Marcar';
import Pantalla from './pages/Pantalla';
import { guardarDeviceToken, obtenerDeviceToken } from './lib/dispositivoStore';

function InicioEmpleado() {
  const [deviceToken, setDeviceToken] = useState(undefined);

  useEffect(() => {
    // El enlace que RRHH comparte/reenvía lleva ?token=... — si llega así, se guarda
    // solo (sin que el empleado tenga que pegarlo a mano) y se limpia de la URL para
    // que no quede visible en el historial del navegador.
    const tokenDeUrl = new URLSearchParams(window.location.search).get('token');
    if (tokenDeUrl) {
      guardarDeviceToken(tokenDeUrl).then(() => {
        window.history.replaceState(null, '', window.location.pathname);
        setDeviceToken(tokenDeUrl);
      });
      return;
    }
    obtenerDeviceToken().then(setDeviceToken);
  }, []);

  if (deviceToken === undefined) return null;
  if (!deviceToken) return <ConfigurarDispositivo onConfigurado={setDeviceToken} />;
  return <Marcar deviceToken={deviceToken} />;
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
