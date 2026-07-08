import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

function Login() {
  const { usuario, restaurando, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  // Ref además del state: el disabled del botón se aplica recién en el próximo
  // render — un doble click muy rápido puede disparar 2 logins antes de eso.
  const cargandoRef = useRef(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      navigate('/hoy');
    } catch (err) {
      setError(err.message);
    } finally {
      cargandoRef.current = false;
      setCargando(false);
    }
  }

  if (restaurando) return null;
  if (usuario) return <Navigate to="/hoy" replace />;

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={manejarSubmit}>
        <h1>Control de Asistencia</h1>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
