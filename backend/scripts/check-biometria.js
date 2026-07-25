const { getPool } = require('../src/config/db');

async function run() {
  const pool = getPool();
  const r = await pool.query(`
    SELECT eb.id, eb.empleado_id, e.nombre, e.apellido, eb.estado, eb.fecha
    FROM enrolamiento_biometrico eb
    JOIN empleado e ON e.id = eb.empleado_id
    ORDER BY eb.fecha DESC
  `);
  console.log(`Total filas en enrolamiento_biometrico: ${r.rows.length}`);
  console.table(r.rows);
  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
