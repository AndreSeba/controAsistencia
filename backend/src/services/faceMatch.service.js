const path = require('path');

// Motor real de face-match: @vladmandic/face-api corriendo en CPU vía WASM (sin
// node-canvas ni tfjs-node — evita dependencias nativas que compilar, clave para
// que el build funcione igual en Render). Modelos y binario WASM se cargan directo
// desde node_modules: no hace falta commitear binarios al repo.
const MODELS_DIR = path.join(__dirname, '..', '..', 'node_modules', '@vladmandic', 'face-api', 'model');
const TAMANO_DESCRIPTOR = 128; // tamaño fijo del embedding de faceRecognitionNet
const UMBRAL_DISTANCIA = Number(process.env.FACE_MATCH_UMBRAL || 0.6); // < umbral = misma persona

class FaceMatchError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

let inicializacion = null;
let faceapi = null;

async function inicializar() {
  if (!inicializacion) {
    inicializacion = (async () => {
      const image = require('@canvas/image');
      const tf = require('@tensorflow/tfjs');
      require('@tensorflow/tfjs-backend-wasm');
      await tf.setBackend('wasm');
      await tf.ready();
      faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
      await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
      return { tf, image };
    })();
  }
  return inicializacion;
}

async function tensorDeBuffer(buffer, tf, image) {
  const canvas = await image.imageFromBuffer(buffer);
  const imageData = image.getImageData(canvas);
  return tf.tidy(() => {
    const data = tf.tensor(Array.from(imageData.data), [canvas.height, canvas.width, 4], 'int32');
    const channels = tf.split(data, 4, 2);
    const rgb = tf.stack([channels[0], channels[1], channels[2]], 2);
    return tf.squeeze(rgb);
  });
}

async function descriptorDeBuffer(imagenBuffer) {
  const { tf, image } = await inicializar();
  let tensor;
  try {
    tensor = await tensorDeBuffer(imagenBuffer, tf, image);
  } catch {
    // Imagen corrupta o formato que el decoder WASM no puede leer: se trata igual
    // que "no se detectó cara" — el caller decide si eso bloquea o no.
    return null;
  }
  try {
    const opciones = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
    const resultado = await faceapi.detectSingleFace(tensor, opciones).withFaceLandmarks().withFaceDescriptor();
    return resultado ? resultado.descriptor : null;
  } finally {
    tf.dispose(tensor);
  }
}

// Genera el template de referencia a partir de la foto de enrolamiento (cara de frente,
// supervisado por RRHH). Se guarda cifrado — ver cifrado.service.js.
async function generarTemplate(imagenBuffer) {
  const descriptor = await descriptorDeBuffer(imagenBuffer);
  if (!descriptor) {
    throw new FaceMatchError('No se detectó una cara clara en la foto. Probá con mejor luz y de frente.');
  }
  return Buffer.from(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength);
}

// Compara la selfie en vivo contra el template de referencia descifrado. Nunca lanza
// por "no coincide" — eso es una señal blanda que decide marcaciones.service.js
// (identidadVerificada=false → requiere_revision), no un bloqueo acá.
async function comparar(selfieBuffer, templateDescifrado) {
  const descriptorVivo = await descriptorDeBuffer(selfieBuffer);
  if (!descriptorVivo) {
    return { score: 0, match: false };
  }

  // Copia a un ArrayBuffer propio (offset 0) antes de envolver en Float32Array:
  // templateDescifrado puede ser una vista (subarray) con byteOffset arbitrario.
  const bytes = Uint8Array.from(templateDescifrado);
  const descriptorReferencia = new Float32Array(bytes.buffer, 0, TAMANO_DESCRIPTOR);

  await inicializar();
  const distancia = faceapi.euclideanDistance(descriptorVivo, descriptorReferencia);
  const score = Math.max(0, 1 - distancia);
  return { score, match: distancia < UMBRAL_DISTANCIA };
}

module.exports = { generarTemplate, comparar, FaceMatchError };
