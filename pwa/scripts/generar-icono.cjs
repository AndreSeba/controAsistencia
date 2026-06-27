// Genera un ícono PNG sólido mínimo (placeholder) para el manifest de la PWA,
// sin depender de librerías de imagen nativas. Reemplazar por el logo real cuando exista.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const tabla = crc32.tabla || (crc32.tabla = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = tabla[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length, 0);
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])), 0);
  return Buffer.concat([longitud, tipoBuf, datos, crcBuf]);
}

function generarPng(tamaño, [r, g, b]) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamaño, 0);
  ihdr.writeUInt32BE(tamaño, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB

  const filaCruda = Buffer.alloc((tamaño * 3 + 1) * tamaño);
  for (let y = 0; y < tamaño; y++) {
    const inicio = y * (tamaño * 3 + 1);
    filaCruda[inicio] = 0; // sin filtro
    for (let x = 0; x < tamaño; x++) {
      const offset = inicio + 1 + x * 3;
      filaCruda[offset] = r;
      filaCruda[offset + 1] = g;
      filaCruda[offset + 2] = b;
    }
  }

  const idat = zlib.deflateSync(filaCruda);

  return Buffer.concat([
    firma,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const destino = path.join(__dirname, '..', 'public');
fs.mkdirSync(destino, { recursive: true });
const morado = [0xaa, 0x3b, 0xff];
fs.writeFileSync(path.join(destino, 'icono-192.png'), generarPng(192, morado));
fs.writeFileSync(path.join(destino, 'icono-512.png'), generarPng(512, morado));
console.log('Íconos generados en public/');
