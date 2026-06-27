const multer = require('multer');

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('Formato de imagen no soportado (usar jpeg/png/webp)'));
    }
    cb(null, true);
  },
});

module.exports = { uploadImagen };
