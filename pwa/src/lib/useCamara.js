import { useEffect, useRef, useState } from 'react';

// facingMode 'environment' para escanear el QR de la sucursal, 'user' para la selfie.
function useCamara(facingMode) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al cambiar de cámara (facingMode)
    setListo(false);
    setError(null);

    // En contexto NO seguro (http:// por IP, no localhost) el navegador ni define
    // navigator.mediaDevices — sin este chequeo, el .getUserMedia() de abajo lanza un
    // TypeError SÍNCRONO que el .catch() no agarra, el error escapa del efecto y React
    // desmonta el árbol entero: pantalla en negro sin ningún mensaje.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('La cámara necesita una conexión segura (HTTPS). Abrí la app desde el enlace oficial.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setListo(true);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo acceder a la cámara. Revisá los permisos del navegador.');
      });

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  // maxAncho (opcional) reduce la imagen proporcionalmente antes de dibujarla. La cámara
  // del celular entrega mucha más resolución de la que el reconocimiento facial necesita
  // (el detector corre con inputSize 320), así que esa resolución de más no aporta nada:
  // solo pesa en Storage y, sobre todo, en la RAM del backend, que decodifica la imagen a
  // píxeles crudos para face-api — una 4000x3000 son ~48MB de RGBA y fue la causa del
  // OOM/502 del 2026-07-25. Sin maxAncho se captura a resolución nativa (el escaneo de QR
  // arma su propio canvas aparte y no pasa por acá: ahí más resolución sí ayuda).
  function capturarFrame(maxAncho) {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const escala = maxAncho && video.videoWidth > maxAncho ? maxAncho / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  return { videoRef, listo, error, capturarFrame };
}

export { useCamara };
