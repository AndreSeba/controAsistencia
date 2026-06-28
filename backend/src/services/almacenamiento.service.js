const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'uploads';

let cliente = null;
function supabase() {
  if (!cliente) {
    cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  }
  return cliente;
}

const EXTENSION_POR_MIMETYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extensionDeMimetype(mimetype) {
  return EXTENSION_POR_MIMETYPE[mimetype] || 'jpg';
}

// Supabase Storage en vez de disco local: Render no tiene filesystem persistente
// (se borra en cada redeploy/restart). Bucket público, sin auth en la lectura —
// las URLs son rutas opacas con UUID, no hay índice navegable (mismo modelo de
// seguridad que el disco local que reemplaza). Solo el backend puede escribir,
// con la secret key.
async function guardar(subcarpeta, buffer, mimetype) {
  const nombre = `${crypto.randomUUID()}.${extensionDeMimetype(mimetype)}`;
  const ruta = `${subcarpeta}/${nombre}`;

  const { error } = await supabase().storage.from(BUCKET).upload(ruta, buffer, {
    contentType: mimetype,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`No se pudo guardar el archivo en Storage: ${error.message}`);

  const { data } = supabase().storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

module.exports = { guardar };
