// Reduce la foto en el navegador antes de subirla. La cámara de un celular entrega
// 8-12MP, pero el reconocimiento facial trabaja con una entrada chica — mandar la
// resolución completa solo infla el peso (subida lenta) y obliga al backend a
// decodificar decenas de MB de píxeles crudos por foto: causa real del OOM/502 de
// Render (free tier, 512MB) durante el enrolamiento del 2026-07-25. Mismo criterio
// que la selfie de la PWA (useCamara.js → capturarFrame(maxAncho)), validado ahí
// con el motor real de face-match.
const ANCHO_MAX_FOTO = 1024;
const CALIDAD_JPEG = 0.85;

export function redimensionarFoto(archivo, maxAncho = ANCHO_MAX_FOTO) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxAncho / img.width);
      const ancho = Math.round(img.width * escala);
      const alto = Math.round(img.height * escala);
      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la foto'))),
        'image/jpeg',
        CALIDAD_JPEG
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen. Probá con otra foto (JPG o PNG).'));
    };
    img.src = url;
  });
}
