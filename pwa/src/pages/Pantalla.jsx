import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { request } from '../lib/api';
import { TOTP } from 'totp-generator';

function Pantalla() {
  const { sucursalId } = useParams();
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [segundosRestantes, setSegundosRestantes] = useState(null);

  useEffect(() => {
    let activo = true;
    let intervaloCuenta;

    async function inicializar() {
      try {
        // Intentamos obtener la llave secreta del servidor (si hay internet)
        const res = await request(`/sucursales/${sucursalId}/qr`);
        if (res && res.totpSecret) {
          localStorage.setItem(`totp_secret_${sucursalId}`, res.totpSecret);
          const offset = res.serverTime ? res.serverTime - Date.now() : 0;
          localStorage.setItem(`time_offset`, offset.toString());
        }
      } catch (err) {
        console.warn('Iniciando en modo offline. Usando llave cacheada.');
      }

      if (!activo) return;
      
      const secret = localStorage.getItem(`totp_secret_${sucursalId}`);
      if (!secret) {
        setError('No hay conexión a internet y no se encontró llave guardada.');
        return;
      }
      
      setError(null);
      
      // Función para renderizar el QR actual
      const renderizarQR = async () => {
        const offset = Number(localStorage.getItem(`time_offset`)) || 0;
        const now = Date.now() + offset;
        
        // Generar TOTP. El secret que tenemos es un HEX de 40 caracteres.
        // totp-generator por defecto espera base32, pero podemos pasarle raw string
        // o mejor usar una configuración si está disponible. 
        // Asumiendo que totp-generator genera a partir del string proporcionado.
        let token = "ERROR";
        try {
          // La libreria totp-generator actual devuelve un objeto { otp, expires }
          const { otp, expires } = TOTP.generate(secret, { digits: 6, period: 30, timestamp: now });
          token = otp;
          
          const payload = JSON.stringify({ sucursalId: Number(sucursalId), token });
          await QRCode.toCanvas(canvasRef.current, payload, { width: 320, margin: 1 });
          
          const restante = Math.max(0, Math.round((expires - now) / 1000));
          setSegundosRestantes(restante);
        } catch(e) {
          console.error('Error generando TOTP:', e);
          if (activo) setError('Error interno generando QR. Revise la llave secreta.');
        }
      };

      await renderizarQR();
      
      intervaloCuenta = setInterval(() => {
        renderizarQR();
      }, 1000);
    }

    inicializar();
    return () => {
      activo = false;
      clearInterval(intervaloCuenta);
    };
  }, [sucursalId]);

  return (
    <div className="pantalla-kiosko">
      <h1>Escaneá para marcar tu asistencia</h1>
      <canvas ref={canvasRef} />
      {error && <p className="error">{error}</p>}
      {segundosRestantes != null && (
        <p className="ayuda">El código se renueva en {segundosRestantes}s</p>
      )}
    </div>
  );
}

export default Pantalla;
