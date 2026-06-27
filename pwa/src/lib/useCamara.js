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

  function capturarFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  return { videoRef, listo, error, capturarFrame };
}

export { useCamara };
