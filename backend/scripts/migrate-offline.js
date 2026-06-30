const { getPool } = require('../src/config/db');
const crypto = require('crypto');

async function run() {
  const pool = getPool();
  try {
    console.log('Aplicando migracion offline...');
    await pool.query('ALTER TABLE sucursal ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)');
    await pool.query('ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS totp_token VARCHAR(6)');
    await pool.query('ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS offline_mode BOOLEAN NOT NULL DEFAULT false');
    
    await pool.query('ALTER TABLE marcacion ALTER COLUMN qr_token_id DROP NOT NULL');
    
    const sucursales = await pool.query('SELECT id FROM sucursal');
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    for (const suc of sucursales.rows) {
      let secret = '';
      for(let i = 0; i < 32; i++) {
        secret += base32Chars[Math.floor(Math.random() * 32)];
      }
      await pool.query('UPDATE sucursal SET totp_secret = $1 WHERE id = $2', [secret, suc.id]);
    }

    console.log('Migracion exitosa');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}
run();
