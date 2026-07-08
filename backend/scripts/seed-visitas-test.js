// Datos de prueba para el reporte de Visitas (Reportes > Visitas). Inserta
// visitas de 2 supervisores a 4 sucursales, repartidas en los últimos 10 días.
const { getPool } = require('../src/config/db');

async function main() {
  const pool = getPool();

  const supervisores = [5, 8]; // seba peinado, Juan Carlos
  const sucursales = [3, 4, 6, 9]; // prueba, alemana, equipetrol, Pizza Rio Alemana

  await pool.query(
    `UPDATE empleado SET es_supervisor = TRUE WHERE id = ANY($1)`,
    [supervisores]
  );

  const filas = [];
  const hoy = new Date();
  for (let dia = 0; dia < 10; dia++) {
    for (const empId of supervisores) {
      const nVisitas = 1 + Math.floor(Math.random() * 2); // 1-2 visitas/día
      for (let v = 0; v < nVisitas; v++) {
        const sucId = sucursales[Math.floor(Math.random() * sucursales.length)];
        const ts = new Date(hoy.getTime() - dia * 86400000 - Math.floor(Math.random() * 8) * 3600000);
        const dentro = Math.random() > 0.15; // 85% dentro de geocerca
        filas.push({ empId, sucId, ts, dentro });
      }
    }
  }

  for (const f of filas) {
    await pool.query(
      `INSERT INTO visita_supervisor (empleado_id, sucursal_id, timestamp_utc, gps_lat, gps_lng, dentro_geocerca)
       VALUES ($1, $2, $3, -17.78 + (random()-0.5)*0.01, -63.18 + (random()-0.5)*0.01, $4)`,
      [f.empId, f.sucId, f.ts, f.dentro]
    );
  }

  console.log(`Insertadas ${filas.length} visitas de prueba (empleados ${supervisores.join(',')}, sucursales ${sucursales.join(',')})`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
