import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import Login from './pages/Login';
import Reportes from './pages/Reportes';
import Sucursales from './pages/Sucursales';
import Empleados from './pages/Empleados';
import Marcaciones from './pages/Marcaciones';
import Descuentos from './pages/Descuentos';
import Turnos from './pages/Turnos';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/sucursales" element={<Sucursales />} />
        <Route path="/empleados" element={<Empleados />} />
        <Route path="/marcaciones" element={<Marcaciones />} />
        <Route path="/descuentos" element={<Descuentos />} />
        <Route path="/turnos" element={<Turnos />} />
      </Route>
      <Route path="*" element={<Navigate to="/reportes" replace />} />
    </Routes>
  );
}

export default App;
