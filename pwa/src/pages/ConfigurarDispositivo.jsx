import { useEffect, useRef, useState } from 'react';
import { guardarDeviceToken } from '../lib/dispositivoStore';
import { request, esErrorDeRed } from '../lib/api';
import { useCamara } from '../lib/useCamara';
import { IconGuardar, IconVolver } from '../components/Icons';
import LogoEmpresa from '../components/LogoEmpresa';

// Auto-activación con link genérico (2026-07-29): la URL raíz de la PWA es la misma para
// todos, no hay nada individual que RRHH tenga que generar ni reenviar. El empleado se
// identifica con su CI y una selfie, que el backend compara contra la biometría que RRHH
// ya enroló — el MISMO motor de face-match que valida cada marcación. No es una barrera
// nueva y más floja: es la que el sistema ya usa a diario, aplicada una vez para vincular
// el teléfono. El device_token sigue siendo la defensa del día a día.
//
// Esta pantalla solo aparece cuando NO hay dispositivo vinculado (ver App.jsx): a quien
// ya lo tiene nunca se le vuelve a pedir el CI ni la selfie.
//
// La selfie NUNCA se sube a Storage, ni acá ni en el backend — solo viaja para comparar
// en memoria. Lo único que persiste es el resultado, en `auditoria`.
const SEGUNDOS_PARA_CAPTURAR = 5; // mismo valor que Marcar.jsx (2026-07-29) — 3s era muy poco
const ANCHO_MAX_SELFIE = 640;
const CALIDAD_JPEG_SELFIE = 0.75;

// Antes de mandar a "hablá con RRHH", se dejan reintentar la selfie unas veces: cubre el
// caso común de mala luz o mal encuadre sin quemar el único intento contra una foto de
// referencia floja. Un error de RED (sin conexión) no cuenta como intento — no fue una
// verificación real, no tiene sentido gastarlo (ver esErrorDeRed en manejarSelfie).
const MAX_INTENTOS = 3;

function PasoSelfie({ onCapturada, onCancelar, mensajeError }) {
  const { videoRef, listo, error, capturarFrame } = useCamara('user');
  const [cuenta, setCuenta] = useState(SEGUNDOS_PARA_CAPTURAR);
  const yaCapturadaRef = useRef(false);

  useEffect(() => {
    if (!listo) return;
    const intervalo = setInterval(() => {
      setCuenta((c) => {
        if (c <= 1) {
          clearInterval(intervalo);
          if (!yaCapturadaRef.current) {
            yaCapturadaRef.current = true;
            const canvas = capturarFrame(ANCHO_MAX_SELFIE);
            canvas?.toBlob((blob) => onCapturada(blob), 'image/jpeg', CALIDAD_JPEG_SELFIE);
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(intervalo);
  }, [listo, capturarFrame, onCapturada]);

  return (
    <div className="paso-camara">
      <h1>Mirá a la cámara</h1>
      {mensajeError && <p className="error">{mensajeError}</p>}
      {error && <p className="error">{error}</p>}
      <video ref={videoRef} className="video-camara espejado" muted playsInline />
      {listo && (
        <p className="cuenta-regresiva">
          Capturando en <span className="numero" key={cuenta}>{cuenta}</span>…
        </p>
      )}
      <button type="button" onClick={onCancelar}><IconVolver /> Cancelar</button>
    </div>
  );
}

function ConfigurarDispositivo({ onConfigurado, errorInicial }) {
  const [paso, setPaso] = useState('ci'); // 'ci' | 'selfie' | 'enviando' | 'fallo-final'
  const [documentoNro, setDocumentoNro] = useState('');
  const [error, setError] = useState(errorInicial || null);
  const [intentos, setIntentos] = useState(0);
  const enviandoRef = useRef(false);

  function continuarASelfie(e) {
    e.preventDefault();
    if (!documentoNro.trim()) return;
    setError(null);
    setIntentos(0);
    setPaso('selfie');
  }

  function volverAlPrincipio() {
    setError(null);
    setIntentos(0);
    setDocumentoNro('');
    setPaso('ci');
  }

  async function manejarSelfie(selfieBlob) {
    if (!selfieBlob) {
      setError('No se pudo tomar la foto. Probá de nuevo.');
      setPaso('selfie');
      return;
    }
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setPaso('enviando');
    try {
      const formData = new FormData();
      formData.append('documentoNro', documentoNro.trim());
      formData.append('selfie', selfieBlob, 'selfie.jpg');

      const { deviceToken } = await request('/empleados/autoactivar-dispositivo', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      await guardarDeviceToken(deviceToken);
      onConfigurado(deviceToken);
    } catch (err) {
      if (esErrorDeRed(err)) {
        // No fue una verificación real — no gasta intento.
        setError('No hay conexión. Conectate a internet e intentá de nuevo.');
        setPaso('selfie');
        return;
      }

      // El backend responde lo mismo para los 4 motivos de rechazo (CI inexistente, cara
      // que no coincide, sin biometría, ya tiene dispositivo activo) — a propósito, para
      // no convertir esto en una forma de averiguar qué CIs son válidos ni de tantear el
      // face-match. Acá tampoco se distingue el motivo, solo si quedan intentos o no.
      const intentosUsados = intentos + 1;
      setIntentos(intentosUsados);
      if (intentosUsados < MAX_INTENTOS) {
        setError('No pudimos confirmarlo. Probá de nuevo, de frente y con buena luz.');
        setPaso('selfie');
      } else {
        setPaso('fallo-final');
      }
    } finally {
      enviandoRef.current = false;
    }
  }

  if (paso === 'selfie') {
    return <PasoSelfie onCapturada={manejarSelfie} onCancelar={volverAlPrincipio} mensajeError={error} />;
  }

  if (paso === 'enviando') {
    return (
      <div className="pantalla-centrada">
        <p>Verificando tu identidad…</p>
      </div>
    );
  }

  if (paso === 'fallo-final') {
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta">
          <LogoEmpresa />
          <h1>No pudimos activar tu teléfono</h1>
          <p className="ayuda">
            Esto puede pasar por varios motivos: el CI no está cargado en el sistema, ya
            tenés otro dispositivo activo, o la foto no fue suficientemente clara. Pedile a
            RRHH que revise tu caso — puede resolverlo rápido desde el panel.
          </p>
          <button type="button" onClick={volverAlPrincipio}><IconVolver /> Intentar de nuevo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <LogoEmpresa />
        <h1>Activá tu teléfono</h1>
        <p className="ayuda">
          Es solo la primera vez. Ingresá tu número de carnet y sacate una foto para
          confirmar que sos vos.
        </p>
        <form onSubmit={continuarASelfie}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número de carnet (CI)"
            value={documentoNro}
            onChange={(e) => setDocumentoNro(e.target.value)}
            maxLength={20}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit"><IconGuardar /> Continuar</button>
        </form>
        <p className="ayuda">
          ¿No funciona? Pedile a RRHH que revise tu caso.
        </p>
      </div>
    </div>
  );
}

export default ConfigurarDispositivo;
