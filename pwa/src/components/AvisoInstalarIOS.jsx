import { useState } from 'react';
import { IconCompartirIOS, IconCerrar } from './Icons';

const CLAVE_DESCARTADO = 'aviso-instalar-ios-descartado';

// Safari en iOS no implementa beforeinstallprompt (a diferencia de Chrome/Android): nunca
// va a sugerir instalar la PWA solo, así que hay que decirlo explícitamente. Detecta iPhone/
// iPad que todavía NO están corriendo como app instalada (navigator.standalone es la forma
// clásica de saberlo en iOS; display-mode:standalone cubre versiones más nuevas).
function esIOSSinInstalar() {
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const yaInstalada = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return esIOS && !yaInstalada;
}

function AvisoInstalarIOS() {
  const [visible, setVisible] = useState(
    () => esIOSSinInstalar() && localStorage.getItem(CLAVE_DESCARTADO) !== '1'
  );

  function cerrar() {
    localStorage.setItem(CLAVE_DESCARTADO, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="aviso-instalar-ios">
      <IconCompartirIOS />
      <span>
        Para instalar esta app: tocá <strong>Compartir</strong> y después
        <strong> "Agregar a pantalla de inicio"</strong>.
      </span>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" title="Cerrar">
        <IconCerrar />
      </button>
    </div>
  );
}

export default AvisoInstalarIOS;
