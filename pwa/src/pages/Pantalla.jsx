import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { request } from '../lib/api';

const REFRESCO_MS = 5000;

function Pantalla() {
  const { sucursalId } = useParams();
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [segundosRestantes, setSegundosRestantes] = useState(null);

  useEffect(() => {
    let activo = true;
    let intervaloCuenta;

    async function actualizar() {
      try {
        const { token, validoHasta } = await request(`/sucursales/${sucursalId}/qr`);
        if (!activo) return;
        setError(null);
        const payload = JSON.stringify({ sucursalId: Number(sucursalId), token });
        await QRCode.toCanvas(canvasRef.current, payload, { width: 320, margin: 1 });

        clearInterval(intervaloCuenta);
        intervaloCuenta = setInterval(() => {
          const restante = Math.max(0, Math.round((new Date(validoHasta) - Date.now()) / 1000));
          setSegundosRestantes(restante);
        }, 1000);
      } catch {
        if (activo) setError('No se pudo cargar el código. Reintentando…');
      }
    }

    actualizar();
    const intervaloRefresco = setInterval(actualizar, REFRESCO_MS);
    return () => {
      activo = false;
      clearInterval(intervaloRefresco);
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
