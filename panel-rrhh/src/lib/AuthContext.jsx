import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setAccessToken, refrescarUnaVez, request as apiRequest } from './api';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // undefined = todavía no se intentó restaurar sesión (evita el flash a /login en cada reload).
  const [restaurando, setRestaurando] = useState(true);

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    setUsuario(data.usuario);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // best-effort: aunque falle el revoke en el server, limpiamos el cliente igual
    }
    setAccessToken(null);
    setUsuario(null);
  }, []);

  const onSesionExpirada = useCallback(async () => {
    try {
      const data = await refrescarUnaVez();
      setAccessToken(data.accessToken);
      setUsuario(data.usuario);
      return true;
    } catch {
      setAccessToken(null);
      setUsuario(null);
      return false;
    }
  }, []);

  // Al montar (incluido un reload de página): la cookie httpOnly del refresh token
  // sigue viva aunque el access token en memoria se haya perdido. Esto es lo que
  // mantiene la sesión sin necesitar volver a loguearse.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restauración de sesión al cargar, no sincronización de UI
    onSesionExpirada().finally(() => setRestaurando(false));
  }, [onSesionExpirada]);

  const request = useCallback(
    (path, opciones = {}) => apiRequest(path, { ...opciones, onSesionExpirada }),
    [onSesionExpirada]
  );

  return (
    <AuthContext.Provider value={{ usuario, restaurando, login, logout, request }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook acoplado al provider, no vale separarlo en otro archivo
export { AuthProvider, useAuth };
