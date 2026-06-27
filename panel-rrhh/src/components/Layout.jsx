import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { alternarTema, obtenerTema } from '../lib/tema';

function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [tema, setTema] = useState(obtenerTema());

  async function manejarLogout() {
    await logout();
    navigate('/login');
  }

  function manejarTema() {
    setTema(alternarTema());
  }

  return (
    <div className="layout">
      <header className="topbar">
        <span className="marca">Control de Asistencia</span>
        <nav>
          <NavLink to="/hoy">Hoy</NavLink>
          <NavLink to="/sucursales">Sucursales</NavLink>
          <NavLink to="/empleados">Empleados</NavLink>
          <NavLink to="/marcaciones">Marcaciones</NavLink>
          <NavLink to="/descuentos">Descuentos</NavLink>
          <NavLink to="/turnos">Turnos</NavLink>
        </nav>
        <div className="usuario">
          <button type="button" onClick={manejarTema} title="Cambiar tema">
            {tema === 'oscuro' ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
          <span>{usuario?.nombre}</span>
          <button type="button" onClick={manejarLogout}>Salir</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
