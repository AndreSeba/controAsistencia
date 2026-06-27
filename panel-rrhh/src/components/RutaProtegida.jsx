import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

function RutaProtegida({ children }) {
  const { usuario, restaurando } = useAuth();
  if (restaurando) return null;
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

export default RutaProtegida;
