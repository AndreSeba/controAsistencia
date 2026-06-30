const { getPool } = require('../src/config/db');

const sucursalesData = [
  { nombre: 'Pizza Rio Alemana', lat: -17.765, lng: -63.167 },
  { nombre: 'Pizza Rio - Beni', lat: -17.772, lng: -63.175 },
  { nombre: 'Pizza Rio Mutualista', lat: -17.778, lng: -63.160 },
  { nombre: 'Pizza Rio Melchor Pinto', lat: -17.785, lng: -63.170 },
  { nombre: 'Pizza Río - Equipetrol', lat: -17.770, lng: -63.195 },
  { nombre: 'Sucursal Santos Dumont', lat: -17.810, lng: -63.180 },
  { nombre: 'Sucursal Doble Vía a La Guardia', lat: -17.815, lng: -63.200 },
  { nombre: 'Sucursal Av. Banzer', lat: -17.750, lng: -63.185 },
  { nombre: 'Sucursal San Aurelio', lat: -17.805, lng: -63.160 },
  { nombre: 'Sucursal Villa Primero de Mayo', lat: -17.795, lng: -63.135 },
  { nombre: 'Sucursal Plan Tres Mil', lat: -17.820, lng: -63.140 }
];

const nombres = ['Juan', 'Maria', 'Pedro', 'Ana', 'Luis', 'Carlos', 'Laura', 'Sofia', 'Diego', 'Jose', 'Carmen', 'Jorge', 'Lucia', 'Miguel', 'Elena'];
const apellidos = ['Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Gomez', 'Fernandez', 'Diaz', 'Alvarez'];

async function run() {
  const pool = getPool();
  console.log('Iniciando inserción de datos de prueba...');

  try {
    // 1. Insertar Sucursales
    console.log('Insertando sucursales...');
    const sucursalesIds = [];
    for (const suc of sucursalesData) {
      const res = await pool.query(
        `INSERT INTO sucursal (nombre, geo_lat, geo_lng, geo_radio_m, activo) 
         VALUES ($1, $2, $3, 100, true) RETURNING id`,
        [suc.nombre, suc.lat, suc.lng]
      );
      sucursalesIds.push(res.rows[0].id);
    }

    // 2. Obtener un rrhh_admin para el enrolamiento (tomamos el primero o creamos mock si no hay)
    let adminRes = await pool.query(`SELECT id FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'rrhh_admin') LIMIT 1`);
    let adminId = adminRes.rows.length > 0 ? adminRes.rows[0].id : null;
    if (!adminId) {
      const rolRes = await pool.query(`SELECT id FROM roles WHERE nombre = 'rrhh_admin'`);
      if(rolRes.rows.length === 0) throw new Error("Rol rrhh_admin no existe");
      const newAdmin = await pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ('Admin Mock', 'admin@mock.com', 'hash', $1) RETURNING id`,
        [rolRes.rows[0].id]
      );
      adminId = newAdmin.rows[0].id;
    }

    const turnoRes = await pool.query(`SELECT id FROM turno_catalogo WHERE nombre = 'MAÑANA' LIMIT 1`);
    const turnoId = turnoRes.rows[0].id;

    const reglasRes = await pool.query(`SELECT * FROM regla_descuento ORDER BY banda_min`);
    const reglas = reglasRes.rows;

    console.log('Insertando 300 empleados con sus respectivas marcaciones...');
    let descuentosGenerados = 0;

    for (let i = 1; i <= 300; i++) {
      const nombre = nombres[Math.floor(Math.random() * nombres.length)];
      const apellido = apellidos[Math.floor(Math.random() * apellidos.length)] + ' ' + apellidos[Math.floor(Math.random() * apellidos.length)];
      const ci = 'CI-' + Math.floor(1000000 + Math.random() * 9000000) + '-' + i;
      
      const empRes = await pool.query(
        `INSERT INTO empleado (nombre, apellido, documento_nro, estado) VALUES ($1, $2, $3, 'activo') RETURNING id`,
        [nombre, apellido, ci]
      );
      const empId = empRes.rows[0].id;

      const sucId = sucursalesIds[Math.floor(Math.random() * sucursalesIds.length)];

      const qrRes = await pool.query(
        `INSERT INTO qr_token (sucursal_id, token, valido_desde, valido_hasta) VALUES ($1, $2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day') RETURNING id`,
        [sucId, 'mock-qr-' + empId + '-' + i]
      );
      const qrId = qrRes.rows[0].id;

      const livenessRes = await pool.query(
        `INSERT INTO liveness_reto (empleado_id, nonce, tipo_reto, expira) VALUES ($1, $2, 'sonreir', NOW() + INTERVAL '1 day') RETURNING id`,
        [empId, 'mock-nonce-' + empId + '-' + i]
      );
      const livenessId = livenessRes.rows[0].id;

      const jornadaRes = await pool.query(
        `INSERT INTO turno_jornada (empleado_id, sucursal_id, fecha, turno_catalogo_id, estado) VALUES ($1, $2, CURRENT_DATE, $3, 'ABIERTO') RETURNING id`,
        [empId, sucId, turnoId]
      );
      const jornadaId = jornadaRes.rows[0].id;

      let atraso = 0;
      if (Math.random() > 0.5) {
        atraso = Math.floor(Math.random() * 70) + 1;
      }

      const marcRes = await pool.query(
        `INSERT INTO marcacion (
          empleado_id, turno_jornada_id, sucursal_id, device_token, tipo, timestamp_utc,
          gps_lat, gps_lng, geo_centro_lat_aplicado, geo_centro_lng_aplicado, geo_radio_aplicado,
          qr_token_id, selfie_url, liveness_ok, liveness_reto_id, identidad_verificada, minutos_atraso
        ) VALUES (
          $1, $2, $3, $4, 'ENTRADA', NOW(),
          0, 0, 0, 0, 100,
          $5, 'http://mock.url/selfie.jpg', true, $6, true, $7
        ) RETURNING id`,
        [empId, jornadaId, sucId, 'device-' + empId, qrId, livenessId, atraso]
      );
      const marcacionId = marcRes.rows[0].id;

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
            `INSERT INTO descuento (marcacion_id, empleado_id, monto_bs, regla_id, periodo) VALUES ($1, $2, $3, $4, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))`,
            [marcacionId, empId, reglaAplicable.monto_bs, reglaAplicable.id]
          );
          descuentosGenerados++;
        }
      }
      
      if (i % 50 === 0) console.log(`... ${i} empleados insertados.`);
    }

    console.log(`\n¡Finalizado!`);
    console.log(`Total empleados insertados: 300`);
    console.log(`Total descuentos generados: ${descuentosGenerados}`);

  } catch (error) {
    console.error('Error durante la inserción:', error);
  } finally {
    await pool.end();
  }
}

run();
