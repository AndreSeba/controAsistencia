// Diagnóstico: estado de los enlaces de activación ya emitidos. Sirve para saber,
// ANTES de desplegar un cambio en el flujo de activación, qué links siguen vivos.
const { getPool } = require('../src/config/db');

async function run() {
  const pool = getPool();
  const r = await pool.query(`
    SELECT e.nombre, e.apellido, d.estado,
           (d.activacion_token IS NOT NULL) AS tiene_codigo,
           d.activacion_usado_en,
           d.fecha_registro
    FROM dispositivo_empleado d
    JOIN empleado e ON e.id = d.empleado_id
    ORDER BY d.fecha_registro DESC
  `);

  const filas = r.rows.map((f) => ({
    persona: `${f.nombre} ${f.apellido}`.trim(),
    dispositivo: f.estado,
    codigo_en_base: f.tiene_codigo ? 'sí' : 'NO (borrado al usarse)',
    ya_activo_el: f.activacion_usado_en
      ? new Date(f.activacion_usado_en).toLocaleString('es-BO')
      : 'nunca abierto',
    link_sigue_sirviendo: f.estado === 'activo' && f.tiene_codigo ? 'SÍ' : 'no',
  }));

  console.log(`Dispositivos registrados: ${filas.length}`);
  console.table(filas);

  const vivos = filas.filter((f) => f.link_sigue_sirviendo === 'SÍ').length;
  const muertos = filas.filter((f) => f.link_sigue_sirviendo === 'no').length;
  console.log(`\nLinks que siguen sirviendo: ${vivos}`);
  console.log(`Links ya muertos (hay que reenviar desde "Copiar enlace"): ${muertos}`);

  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
