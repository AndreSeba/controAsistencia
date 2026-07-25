const { getPool } = require('../src/config/db');

async function run() {
  const pool = getPool();
  const fks = await pool.query(`
    SELECT
      tc.table_name AS tabla_hija,
      kcu.column_name AS columna,
      ccu.table_name AS tabla_padre
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tabla_padre, tabla_hija;
  `);
  console.log('--- FOREIGN KEYS (hija.columna -> padre) ---');
  fks.rows.forEach((r) => console.log(`${r.tabla_hija}.${r.columna} -> ${r.tabla_padre}`));

  const counts = await pool.query(`
    SELECT relname AS tabla, n_live_tup AS filas_aprox
    FROM pg_stat_user_tables ORDER BY relname;
  `);
  console.log('--- CONTEO APROX DE FILAS ---');
  counts.rows.forEach((r) => console.log(`${r.tabla}: ${r.filas_aprox}`));
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
