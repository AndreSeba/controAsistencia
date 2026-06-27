const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const EXTENSION_POR_MIMETYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extensionDeMimetype(mimetype) {
  return EXTENSION_POR_MIMETYPE[mimetype] || 'jpg';
}

// Almacenamiento local en disco para el piloto. Sin auth en el static serve (ver app.js):
// las URLs son rutas opacas con UUID, no hay índice navegable.
async function guardar(subcarpeta, buffer, mimetype) {
  const dir = path.join(UPLOADS_DIR, subcarpeta);
  await fs.promises.mkdir(dir, { recursive: true });
  const nombre = `${crypto.randomUUID()}.${extensionDeMimetype(mimetype)}`;
  await fs.promises.writeFile(path.join(dir, nombre), buffer);
  return `/uploads/${subcarpeta}/${nombre}`;
}

module.exports = { guardar, UPLOADS_DIR };
