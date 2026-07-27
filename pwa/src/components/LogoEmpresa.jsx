import { useEffect, useState } from 'react';
import { request } from '../lib/api';

// Logo que la empresa carga desde el panel (Áreas y horarios → Identidad). Se pide al
// endpoint PÚBLICO de configuración: la PWA no tiene JWT, y esta pantalla puede verse
// incluso antes de que el teléfono esté activado.
//
// Si no hay logo cargado, la petición falla o el archivo no carga, no se renderiza nada:
// es decoración, nunca puede romper ni demorar el flujo de marcación.
function LogoEmpresa() {
  const [logoUrl, setLogoUrl] = useState(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => {
    let vigente = true;
    request('/configuracion/publica')
      .then((c) => { if (vigente && c?.logoUrl) setLogoUrl(c.logoUrl); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []);

  if (!logoUrl) return null;
  return <img src={logoUrl} alt="" className="logo-empresa" onError={() => setLogoUrl(null)} />;
}

export default LogoEmpresa;
