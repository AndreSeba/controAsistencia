const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/db');

const SQL_DIR = path.join(__dirname, '..', 'sql');

async function run() {
  const pool = getPool();
  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const script = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
    console.log(`-- ${file}`);
    await pool.query(script);
  }

  console.log('Migraciones aplicadas.');
  await pool.end();
}

run().catch((err) => {
  console.error('Error al migrar:', err.message);
  process.exit(1);
});
