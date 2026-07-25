// Borra los datos de prueba/demo (sucursales, personal, dispositivos, biometría y todo
// lo transaccional que depende de ellos) para dejar la base limpia antes del piloto real.
// NO toca: usuarios/roles (login de RRHH), turno_catalogo/turno_bloque (áreas y horarios),
// regla_descuento (tarifas), configuracion (parámetros generales), auditoria (historial).
//
// Uso: node --env-file=.env scripts/reset-datos-prueba.js --si-estoy-seguro
// Sin ese flag no borra nada (solo muestra qué haría), para evitar un click accidental.

const { getPool } = require('../src/config/db');

// Orden de borrado: hijas antes que padres, según las foreign keys reales del esquema.
const TABLAS_EN_ORDEN = [
  'descuento',
  'dispositivo_corporativo_empleado',
  'marcacion',
  'visita_supervisor',
  'novedad',
  'enrolamiento_biometrico',
  'dispositivo_empleado',
  'liveness_reto',
  'turno_jornada',
  'qr_token',
  'dispositivo_corporativo',
  'empleado',
  'sucursal',
];

async function contar(pool, tablas) {
  const out = {};
  for (const t of tablas) {
    const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
    out[t] = Number(r.rows[0].count);
  }
  return out;
}

async function run() {
  const confirmar = process.argv.includes('--si-estoy-seguro');
  const pool = getPool();

  const antes = await contar(pool, TABLAS_EN_ORDEN);
  console.log('--- Filas actuales ---');
  console.table(antes);

  if (!confirmar) {
    console.log('\nModo simulación (no se borró nada). Para ejecutar de verdad:');
    console.log('  node --env-file=.env scripts/reset-datos-prueba.js --si-estoy-seguro');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const tabla of TABLAS_EN_ORDEN) {
      await client.query(`DELETE FROM ${tabla}`);
      console.log(`Borrado: ${tabla}`);
    }
    await client.query('COMMIT');
    console.log('\nListo. Todo o nada: si algo hubiera fallado, no se borraba nada.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error, se revirtió todo (no quedó nada borrado):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  const despues = await contar(pool, TABLAS_EN_ORDEN);
  console.log('--- Filas después ---');
  console.table(despues);
  await pool.end();
}

run().catch((err) => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
