const bcrypt = require('bcrypt');
const { getPool } = require('../src/config/db');

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'rrhh@pizzario.bo';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'CambiarEsto_2026!';

async function run() {
  const pool = getPool();

  const rol = await pool.query("SELECT id FROM roles WHERE nombre = 'rrhh_admin'");
  if (!rol.rows[0]) {
    throw new Error('Rol rrhh_admin no existe. Correr las migraciones primero.');
  }
  const rolId = rol.rows[0].id;

  const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [EMAIL]);
  if (existente.rows[0]) {
    console.log(`Usuario ${EMAIL} ya existe, no se modifica.`);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 12);
  await pool.query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, $3, $4)',
    ['RRHH Admin', EMAIL, hash, rolId]
  );

  console.log(`Usuario rrhh_admin creado: ${EMAIL} / ${PASSWORD} (cambiar en producción)`);
  await pool.end();
}

run().catch((err) => {
  console.error('Error al crear el admin:', err.message);
  process.exit(1);
});
