const { getPool } = require('../src/config/db');

async function run() {
  const pool = getPool();
  console.log('Iniciando inserción de datos de prueba en diferentes fechas...');

  try {
    const sucursalesRes = await pool.query('SELECT id FROM sucursal');
    const empleadosRes = await pool.query('SELECT id FROM empleado');
    const reglasRes = await pool.query('SELECT * FROM regla_descuento ORDER BY banda_min');
    
    if (sucursalesRes.rows.length === 0 || empleadosRes.rows.length === 0 || reglasRes.rows.length === 0) {
      console.log('Faltan sucursales, empleados o reglas de descuento para sembrar datos.');
      return;
    }

    const sucursalesIds = sucursalesRes.rows.map(r => r.id);
    const empleadosIds = empleadosRes.rows.map(r => r.id);
    const reglas = reglasRes.rows;

    let marcacionesInsertadas = 0;
    let descuentosAplicados = 0;

    for (let i = 0; i < 500; i++) {
      const empId = empleadosIds[Math.floor(Math.random() * empleadosIds.length)];
      const sucId = sucursalesIds[Math.floor(Math.random() * sucursalesIds.length)];
      
      // Random date within the last 90 days
      const daysAgo = Math.floor(Math.random() * 90);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const isoDate = date.toISOString().slice(0, 10);
      const isoPeriod = isoDate.slice(0, 7); // YYYY-MM

      let atraso = 0;
      if (Math.random() > 0.4) {
        atraso = Math.floor(Math.random() * 70) + 1;
      }

      // Generate TOTP token mock instead of qr_token
      const timestamp_utc = new Date(date);
      timestamp_utc.setHours(11, atraso, 0); // Assuming 11:00 is start time

      // Get a turno_catalogo_id
      const turnoRes = await pool.query(`SELECT id FROM turno_catalogo WHERE nombre = 'MAÑANA' LIMIT 1`);
      const turnoId = turnoRes.rows[0].id;

      const jornadaRes = await pool.query(
        `INSERT INTO turno_jornada (empleado_id, sucursal_id, fecha, turno_catalogo_id, estado) VALUES ($1, $2, $3, $4, 'CERRADO') RETURNING id`,
        [empId, sucId, isoDate, turnoId]
      );
      const jornadaId = jornadaRes.rows[0].id;

      const marcRes = await pool.query(
        `INSERT INTO marcacion (
          empleado_id, turno_jornada_id, sucursal_id, device_token, tipo, timestamp_utc,
          gps_lat, gps_lng, geo_centro_lat_aplicado, geo_centro_lng_aplicado, geo_radio_aplicado,
          selfie_url, liveness_ok, identidad_verificada, minutos_atraso, offline_mode, totp_token, estado
        ) VALUES (
          $1, $2, $3, 'mock-device', 'ENTRADA', $4,
          0, 0, 0, 0, 100,
          'http://mock.url/selfie.jpg', true, true, $5, false, '123456', 'registrada'
        ) RETURNING id`,
        [empId, jornadaId, sucId, timestamp_utc.toISOString(), atraso]
      );
      const marcacionId = marcRes.rows[0].id;
      marcacionesInsertadas++;

      if (atraso > 5) {
        let reglaAplicable = null;
        for (const regla of reglas) {
          if (atraso >= regla.banda_min && (regla.banda_max === null || atraso <= regla.banda_max)) {
            reglaAplicable = regla;
            break;
          }
        }

        if (reglaAplicable && reglaAplicable.monto_bs > 0) {
          await pool.query(
            `INSERT INTO descuento (marcacion_id, empleado_id, monto_bs, regla_id, periodo, estado) 
             VALUES ($1, $2, $3, $4, $5, 'aplicado')`,
            [marcacionId, empId, reglaAplicable.monto_bs, reglaAplicable.id, isoPeriod]
          );
          descuentosAplicados++;
        }
      }
      
      if (i % 100 === 0) console.log(`... ${i} marcaciones generadas.`);
    }

    console.log(`\n¡Finalizado!`);
    console.log(`Total marcaciones insertadas: ${marcacionesInsertadas}`);
    console.log(`Total descuentos aplicados generados: ${descuentosAplicados}`);

  } catch (error) {
    console.error('Error durante la inserción:', error);
  } finally {
    await pool.end();
  }
}

run();
