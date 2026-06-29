import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useCamara } from '../lib/useCamara';
import { request, ApiError } from '../lib/api';
import { obtenerUbicacion } from '../lib/geolocalizacion';

const SEGUNDOS_PARA_CAPTURAR = 3;

function PasoEscaneo({ onDetectado }) {
  const { videoRef, listo, error } = useCamara('environment');
  const yaDetectadoRef = useRef(false);

  useEffect(() => {
    if (!listo) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const intervalo = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || yaDetectadoRef.current) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const resultado = jsQR(imagen.data, imagen.width, imagen.height);
      if (resultado) {
        try {
          const datos = JSON.parse(resultado.data);
          if (datos.sucursalId && datos.token) {
            yaDetectadoRef.current = true;
            onDetectado(datos);
          }
        } catch {
          // QR ajeno al sistema: se ignora y se sigue escaneando.
        }
      }
    }, 300);

    return () => clearInterval(intervalo);
  }, [listo, videoRef, onDetectado]);

  return (
    <div className="paso-camara">
      <h1>Apuntá al código de la sucursal</h1>
      {error && <p className="error">{error}</p>}
      <video ref={videoRef} className="video-camara" muted playsInline />
    </div>
  );
}

function PasoSelfie({ onCapturada }) {
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
            const canvas = capturarFrame();
            canvas?.toBlob((blob) => onCapturada(blob), 'image/jpeg', 0.85);
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
      {error && <p className="error">{error}</p>}
      <video ref={videoRef} className="video-camara espejado" muted playsInline />
      {listo && (
        <p className="cuenta-regresiva">
          Capturando en <span className="numero" key={cuenta}>{cuenta}</span>…
        </p>
      )}
    </div>
  );
}

function PasoElegirTipo({ onElegir }) {
  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <h1>¿Qué vas a marcar?</h1>
        <div className="botones-tipo">
          <button type="button" onClick={() => onElegir('ENTRADA')}>⬆ Entrada</button>
          <button type="button" onClick={() => onElegir('SALIDA')}>⬇ Salida</button>
        </div>
      </div>
    </div>
  );
}

function Marcar({ deviceToken }) {
  const [paso, setPaso] = useState('elegirTipo');
  const [tipoElegido, setTipoElegido] = useState(null);
  const [qrDetectado, setQrDetectado] = useState(null);
  const [reto, setReto] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  function manejarTipoElegido(tipo) {
    setTipoElegido(tipo);
    setPaso('escaneando');
  }

  async function manejarQrDetectado(datos) {
    setQrDetectado(datos);
    setError(null);
    try {
      const nuevoReto = await request('/marcaciones/reto-liveness', { method: 'POST', deviceToken });
      setReto(nuevoReto);
      setPaso('reto');
    } catch (err) {
      setError(err.message);
      setPaso('error');
    }
  }

  async function manejarSelfieCapturada(selfieBlob) {
    if (!selfieBlob) {
      setError('No se pudo capturar la foto. Intentá de nuevo.');
      setPaso('error');
      return;
    }
    setPaso('enviando');
    try {
      const ubicacion = await obtenerUbicacion();
      const formData = new FormData();
      formData.append('selfie', selfieBlob, 'selfie.jpg');
      formData.append('sucursalId', qrDetectado.sucursalId);
      formData.append('qrToken', qrDetectado.token);
      formData.append('livenessNonce', reto.nonce);
      formData.append('tipo', tipoElegido);
      if (ubicacion.lat != null) {
        formData.append('gpsLat', ubicacion.lat);
        formData.append('gpsLng', ubicacion.lng);
        formData.append('gpsPrecisionM', ubicacion.precisionM);
      }
      const marcacion = await request('/marcaciones', {
        method: 'POST',
        deviceToken,
        body: formData,
        isFormData: true,
      });
      setResultado(marcacion);
      setPaso('resultado');
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar la marcación. Probá de nuevo.';
      setError(mensaje);
      setPaso('error');
    }
  }

  function reintentar() {
    setError(null);
    setTipoElegido(null);
    setQrDetectado(null);
    setReto(null);
    setResultado(null);
    setPaso('elegirTipo');
  }

  if (paso === 'elegirTipo') {
    return <PasoElegirTipo onElegir={manejarTipoElegido} />;
  }

  if (paso === 'escaneando') {
    return <PasoEscaneo onDetectado={manejarQrDetectado} />;
  }

  if (paso === 'reto') {
    return <PasoSelfie onCapturada={manejarSelfieCapturada} />;
  }

  if (paso === 'enviando') {
    return (
      <div className="pantalla-centrada">
        <p>Registrando tu marcación…</p>
      </div>
    );
  }

  if (paso === 'resultado') {
    const exito = resultado.estado === 'registrada';
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta resultado">
          <p className="icono-resultado">{exito ? '✅' : '⚠️'}</p>
          <h1>{resultado.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada'}</h1>
          {!exito && <p className="ayuda">Quedó marcada para revisión, pero tu marca ya quedó guardada.</p>}
          <button type="button" onClick={reintentar}>Volver a marcar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <p className="error">{error}</p>
        <button type="button" onClick={reintentar}>Reintentar</button>
      </div>
    </div>
  );
}

export default Marcar;
