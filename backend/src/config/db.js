const { Pool } = require('pg');

let pool;

// Supabase exige SSL; un PostgreSQL local (entorno de desarrollo) no lo soporta y
// rechaza la conexión con "The server does not support SSL connections". Se decide por
// el host de la propia URL en vez de una variable aparte: así nadie tiene que acordarse
// de setearla, y producción (pooler de Supabase) nunca queda sin SSL por olvido.
function requiereSsl(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return true; // ante una URL rara, el default seguro es CON SSL
  }
}

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      ssl: requiereSsl(connectionString) ? { rejectUnauthorized: false } : false,
      // Red de seguridad: el default de pg es 0 = esperar una conexión libre PARA
      // SIEMPRE. Si el pool se saturara, las requests quedaban colgadas sin timeout y
      // el empleado veía "Registrando tu marcación…" eternamente (y reintentaba, lo que
      // lo empeora). Con esto falla en 10s con un error claro, recuperable.
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

module.exports = { getPool };
