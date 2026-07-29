import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useCamara } from '../lib/useCamara';
import { request, ApiError, esErrorDeRed } from '../lib/api';
import { obtenerUbicacion } from '../lib/geolocalizacion';
import { guardarMarcacionOffline, sincronizarPendientes } from '../lib/offlineSync';
import { IconEntrada, IconSalida, IconVisita, IconVolver, IconPersonas } from '../components/Icons';
import LogoEmpresa from '../components/LogoEmpresa';

const SEGUNDOS_PARA_CAPTURAR = 3;
// La selfie se reduce antes de subirla: el motor de face-match detecta con inputSize 320,
// así que 640px de ancho le sobran, y el backend deja de decodificar imágenes de 8-12MP a
// píxeles crudos (causa del OOM/502 del 2026-07-25). También mantiene el consumo de
// Supabase Storage dentro del plan gratuito con el volumen del piloto.
const ANCHO_MAX_SELFIE = 640;
const CALIDAD_JPEG_SELFIE = 0.75;

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

// Celular corporativo compartido: el token no resuelve a un único empleado, así que
// antes de Entrada/Salida hay que preguntar quién es la persona que tiene el teléfono
// en la mano. Se pregunta CADA VEZ (no se recuerda entre marcaciones): el celular pasa
// de mano en mano durante el día.
function PasoQuienSos({ empleados, onElegir }) {
  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <LogoEmpresa />
        <h1><IconPersonas /> ¿Quién sos?</h1>
        <p className="ayuda">Este es un celular compartido. Elegí tu nombre para continuar.</p>
        <div className="botones-quien-sos">
          {empleados.map((emp) => (
            <button type="button" key={emp.id} onClick={() => onElegir(emp)}>
              {emp.nombre} {emp.apellido}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// El supervisor no marca su propia asistencia (no cobra por día trabajado vía este
// sistema) — solo ve el botón de visita. El resto del personal ve Entrada/Salida.
function PasoElegirTipo({ onElegir, esSupervisor, onVisita }) {
  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <LogoEmpresa />
        <h1>{esSupervisor ? 'Registrar visita' : '¿Qué vas a marcar?'}</h1>
        <div className="botones-tipo">
          {esSupervisor ? (
            <button type="button" className="boton-visita" onClick={onVisita}><IconVisita /> Registrar visita a sucursal</button>
          ) : (
            <>
              <button type="button" onClick={() => onElegir('ENTRADA')}><IconEntrada /> Entrada</button>
              <button type="button" onClick={() => onElegir('SALIDA')}><IconSalida /> Salida</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Marcar({ deviceToken }) {
  const [paso, setPaso] = useState('cargandoPerfil');
  const [tipoElegido, setTipoElegido] = useState(null);
  const [qrDetectado, setQrDetectado] = useState(null);
  const [reto, setReto] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [esSupervisor, setEsSupervisor] = useState(false);
  const [compartido, setCompartido] = useState(false);
  const [empleadosDisponibles, setEmpleadosDisponibles] = useState([]);
  const [empleadoId, setEmpleadoId] = useState(null); // solo se usa (y se manda al backend) en un dispositivo compartido

  // Saber si el token es de un dispositivo personal (empleado ya identificado por el
  // device_token, como siempre) o de un celular corporativo compartido (varios
  // empleados habilitados) — en ese caso hay que preguntar "¿Quién sos?" antes de
  // dejar elegir Entrada/Salida. Si falla (offline, etc.) se sigue como personal sin
  // bloquear, igual que antes.
  useEffect(() => {
    request('/empleados/yo', { deviceToken })
      .then((yo) => {
        if (yo.compartido) {
          setCompartido(true);
          setEmpleadosDisponibles(yo.empleados);
          setPaso('quienSos');
        } else {
          setEsSupervisor(yo.esSupervisor === true);
          setPaso('elegirTipo');
        }
      })
      .catch(() => setPaso('elegirTipo'));
  }, [deviceToken]);

  function manejarQuienSos(empleado) {
    setEmpleadoId(empleado.id);
    setEsSupervisor(empleado.esSupervisor === true);
    setPaso('elegirTipo');
  }

  function manejarTipoElegido(tipo) {
    setTipoElegido(tipo);
    setPaso('escaneando');
  }

  async function manejarQrVisita(datos) {
    setPaso('enviandoVisita');
    try {
      let ubicacion = { lat: null, lng: null };
      try {
        ubicacion = await obtenerUbicacion();
      } catch {
        // Sin GPS la visita igual se registra (queda "Sin GPS" en el reporte).
      }
      const visita = await request('/visitas', {
        method: 'POST',
        deviceToken,
        body: {
          sucursalId: datos.sucursalId,
          qrToken: datos.token,
          gpsLat: ubicacion.lat,
          gpsLng: ubicacion.lng,
          ...(compartido && { empleadoId }),
        },
      });
      setResultado({ estado: 'visita_ok', sucursal: visita.sucursal, tipo: visita.tipo });
      setPaso('resultado');
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar la visita. Probá de nuevo.';
      setError(mensaje);
      setPaso('error');
    }
  }

  // Sincronizar en segundo plano al recuperar la conexión
  useEffect(() => {
    const handleOnline = async () => {
      try {
        await sincronizarPendientes(deviceToken);
      } catch(e) {
        // Ignorar errores de background sync
      }
    };
    window.addEventListener('online', handleOnline);
    // Intentamos sincronizar al inicio por si había algo pendiente
    if (navigator.onLine) {
      handleOnline();
    }
    return () => window.removeEventListener('online', handleOnline);
  }, [deviceToken]);

  async function manejarQrDetectado(datos) {
    setQrDetectado(datos);
    setError(null);
    try {
      const nuevoReto = await request('/marcaciones/reto-liveness', {
        method: 'POST',
        deviceToken,
        body: compartido ? { empleadoId } : undefined,
      });
      setReto(nuevoReto);
      setPaso('reto');
    } catch (err) {
      if (esErrorDeRed(err)) {
        // Modo offline
        setReto({ nonce: 'offline-' + Date.now() });
        setPaso('reto');
      } else {
        setError(err.message);
        setPaso('error');
      }
    }
  }

  async function manejarSelfieCapturada(selfieBlob) {
    if (!selfieBlob) {
      setError('No se pudo capturar la foto. Intentá de nuevo.');
      setPaso('error');
      return;
    }
    setPaso('enviando');
    // Fuera del try: el catch de red lo reusa para encolar offline el MISMO payload
    // (incluido el GPS ya capturado) — antes armaba uno nuevo sin GPS y esas marcaciones
    // llegaban como "fuera de geocerca", inflando la cola de revisión de RRHH al pedo.
    let payload = null;
    try {
      // Capturamos ubicación (podría fallar sin internet, pero el navegador la cachea a veces)
      let ubicacion = { lat: null, lng: null, precisionM: null };
      try {
        ubicacion = await obtenerUbicacion();
      } catch (e) {
        // Seguimos sin ubicación si falla
      }

      payload = {
        selfieBlob,
        sucursalId: qrDetectado.sucursalId,
        qrToken: qrDetectado.token,
        livenessNonce: reto.nonce,
        tipo: tipoElegido,
        gpsLat: ubicacion.lat,
        gpsLng: ubicacion.lng,
        gpsPrecisionM: ubicacion.precisionM,
        ...(compartido && { empleadoId }),
      };

      if (!navigator.onLine || reto.nonce.startsWith('offline-')) {
        await guardarMarcacionOffline(payload);
        setResultado({ estado: 'registrada_offline', tipo: tipoElegido });
        setPaso('resultado');
        return;
      }

      const formData = new FormData();
      formData.append('selfie', selfieBlob, 'selfie.jpg');
      formData.append('sucursalId', payload.sucursalId);
      formData.append('qrToken', payload.qrToken);
      formData.append('livenessNonce', payload.livenessNonce);
      formData.append('tipo', payload.tipo);
      if (payload.gpsLat != null) {
        formData.append('gpsLat', payload.gpsLat);
        formData.append('gpsLng', payload.gpsLng);
        formData.append('gpsPrecisionM', payload.gpsPrecisionM);
      }
      if (compartido) {
        formData.append('empleadoId', empleadoId);
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
      if (esErrorDeRed(err)) {
        // Guardar offline si falla la red al enviar — con el payload completo (GPS
        // incluido); el fallback sin ?? es solo por si el error saltó antes de armarlo.
        try {
          await guardarMarcacionOffline(payload ?? {
            selfieBlob,
            sucursalId: qrDetectado.sucursalId,
            qrToken: qrDetectado.token,
            livenessNonce: reto.nonce,
            tipo: tipoElegido,
            ...(compartido && { empleadoId }),
          });
          setResultado({ estado: 'registrada_offline', tipo: tipoElegido });
          setPaso('resultado');
        } catch(e) {
          setError('Fallo guardando la marcación offline.');
          setPaso('error');
        }
      } else {
        const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar la marcación. Probá de nuevo.';
        setError(mensaje);
        setPaso('error');
      }
    }
  }

  function reintentar() {
    setError(null);
    setTipoElegido(null);
    setQrDetectado(null);
    setReto(null);
    setResultado(null);
    // En un dispositivo compartido se vuelve a preguntar quién es: el celular pasa de
    // mano en mano, no hay que asumir que sigue siendo la misma persona.
    if (compartido) {
      setEmpleadoId(null);
      setPaso('quienSos');
    } else {
      setPaso('elegirTipo');
    }
  }

  if (paso === 'cargandoPerfil') {
    return null;
  }

  if (paso === 'quienSos') {
    return <PasoQuienSos empleados={empleadosDisponibles} onElegir={manejarQuienSos} />;
  }

  if (paso === 'elegirTipo') {
    return (
      <PasoElegirTipo
        onElegir={manejarTipoElegido}
        esSupervisor={esSupervisor}
        onVisita={() => setPaso('escaneandoVisita')}
      />
    );
  }

  if (paso === 'escaneando') {
    return <PasoEscaneo onDetectado={manejarQrDetectado} />;
  }

  if (paso === 'escaneandoVisita') {
    return <PasoEscaneo onDetectado={manejarQrVisita} />;
  }

  if (paso === 'enviandoVisita') {
    return (
      <div className="pantalla-centrada">
        <p>Registrando tu visita…</p>
      </div>
    );
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
    if (resultado.estado === 'visita_ok') {
      return (
        <div className="pantalla-centrada">
          <div className="tarjeta resultado">
            <p className="icono-resultado">Listo</p>
            <h1>{resultado.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada'}</h1>
            <p className="ayuda">{resultado.sucursal}</p>
            <button type="button" onClick={reintentar}><IconVolver /> Volver</button>
          </div>
        </div>
      );
    }
    const offline = resultado.estado === 'registrada_offline';
    const exito = resultado.estado === 'registrada' || offline;
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta resultado">
          <p className={`icono-resultado${exito ? '' : ' atencion'}`}>{exito ? 'Listo' : 'Atención'}</p>
          <h1>{resultado.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada'}</h1>
          {!exito && <p className="ayuda">Quedó marcada para revisión, pero tu marca ya quedó guardada.</p>}
          {offline && (
             <div style={{ backgroundColor: '#ffcc00', color: '#000', padding: '10px', borderRadius: '5px', marginTop: '10px' }}>
               <p><strong>Estás sin conexión</strong></p>
               <p style={{fontSize:'0.9rem'}}>La marcación se guardó en tu dispositivo. Se enviará automáticamente cuando recuperes el internet.</p>
             </div>
          )}
          <button type="button" onClick={reintentar}><IconVolver /> Volver a marcar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta">
        <p className="error">{error}</p>
        <button type="button" onClick={reintentar}><IconVolver /> Reintentar</button>
      </div>
    </div>
  );
}

export default Marcar;
