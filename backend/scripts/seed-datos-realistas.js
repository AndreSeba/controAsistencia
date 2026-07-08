// Reemplaza los datos de prueba viejos (300 empleados random de un solo día,
// sin salida, sin áreas reales) por una simulación de 3 meses con el modelo
// ACTUAL: áreas con bloques, doble marcación en horario partido, descuentos
// automáticos por banda, ausencias, jornadas auto-cerradas y visitas de
// supervisor. Pensado para dar de una vez un panel que "se vea real".
//
// Borra: empleado, marcacion, turno_jornada, descuento, novedad,
// visita_supervisor, dispositivo_empleado, enrolamiento_biometrico,
// liveness_reto, qr_token (obsoleta). NO toca: sucursal, turno_catalogo/
// turno_bloque reales, usuarios/roles/RBAC, configuracion, regla_descuento.
// También borra las áreas de prueba de smoke tests (ADMIN/AREA/SIMPLE SMOKE,
// "prueba mensaje").
const { getPool } = require('../src/config/db');

const OFFSET_HRS = 4; // Bolivia UTC-4: utc = local + 4h
const DIAS_HISTORIA = 90;
const AREAS_JUNK = ['ADMIN SMOKE', 'AREA SMOKE', 'SIMPLE SMOKE', 'prueba mensaje'];
const SUCURSALES_PILOTO = ['Pizza Rio Alemana', 'Pizza Rio - Beni', 'Pizza Rio Mutualista'];

const NOMBRES_EMPLEADOS = [
  ['Marcelo', 'Vargas Roca'], ['Fabiola', 'Suarez Ortiz'], ['Ronald', 'Justiniano Paz'],
  ['Daniela', 'Melgar Ribera'], ['Freddy', 'Antelo Cuellar'], ['Vanessa', 'Chavez Rivero'],
  ['Gonzalo', 'Salvatierra Mendez'], ['Ingrid', 'Zabala Rios'], ['Alvaro', 'Camacho Soliz'],
  ['Patricia', 'Rocabado Aguilar'], ['Wilson', 'Terrazas Bejarano'], ['Rosario', 'Barbery Ferrufino'],
  ['Hugo', 'Roca Justiniano'], ['Verónica', 'Añez Montaño'], ['Ruben', 'Paz Cronembold'],
  ['Silvia', 'Melgar Cuellar'], ['Erick', 'Suarez Vaca'], ['Gabriela', 'Rivero Salvatierra'],
  ['Oscar', 'Cuellar Antelo'], ['Mariana', 'Justiniano Roca'], ['Franz', 'Ortiz Bejarano'],
  ['Karina', 'Vaca Rocabado'], ['Edwin', 'Montaño Terrazas'], ['Yolanda', 'Ribera Zabala'],
  ['Nestor', 'Añez Camacho'], ['Claudia', 'Ferrufino Roca'], ['Adalberto', 'Cronembold Paz'],
  ['Beatriz', 'Bejarano Salvatierra'], ['Renzo', 'Rocabado Antelo'], ['Ximena', 'Aguilar Melgar'],
  ['Tito', 'Soliz Chavez'], ['Nadia', 'Rios Vargas'], ['Marco', 'Cuellar Justiniano'],
  ['Cinthia', 'Zabala Suarez'],
];

function pad2(n) { return String(n).padStart(2, '0'); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function fechaISO(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

// Timestamp UTC a partir de fecha+hora LOCAL (Bolivia), reproduciendo horario.util.js.
function utcDesdeLocal(y, m, d, hh, mm) {
  return new Date(Date.UTC(y, m - 1, d, hh + OFFSET_HRS, mm, 0));
}

function sumarMinutos(horaHHMM, minutos) {
  const [h, m] = horaHHMM.split(':').map(Number);
  let total = h * 60 + m + minutos;
  total = ((total % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

// Reproduce la distribución de llegada de calcularMinutosAtraso: offset>0 => atraso,
// offset<=0 => a tiempo (minutos_atraso queda NULL, igual que en el sistema real).
function generarOffsetEntrada() {
  const r = Math.random();
  if (r < 0.50) return randInt(-15, 0);
  if (r < 0.65) return randInt(1, 5);
  if (r < 0.80) return randInt(6, 15);
  if (r < 0.90) return randInt(16, 30);
  if (r < 0.96) return randInt(31, 45);
  if (r < 0.99) return randInt(46, 60);
  return randInt(61, 100);
}

function bandaParaAtraso(atraso, reglas) {
  if (atraso == null || atraso <= 0) return null;
  return reglas.find((r) => atraso >= r.banda_min && (r.banda_max == null || atraso <= r.banda_max)) || null;
}

// INSERT multi-fila en chunks (Postgres soporta hasta 65535 params por statement).
async function insertarLote(client, tabla, columnas, filas, opcionesExtra = '') {
  const ids = [];
  const TAM_LOTE = 400;
  for (let i = 0; i < filas.length; i += TAM_LOTE) {
    const lote = filas.slice(i, i + TAM_LOTE);
    const params = [];
    const valuesSql = lote.map((fila) => {
      const placeholders = fila.map((valor) => { params.push(valor); return `$${params.length}`; });
      return `(${placeholders.join(',')})`;
    }).join(',');
    const result = await client.query(
      `INSERT INTO ${tabla} (${columnas.join(',')}) VALUES ${valuesSql} ${opcionesExtra} RETURNING id`,
      params
    );
    for (const row of result.rows) ids.push(row.id);
  }
  return ids;
}

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Borrando datos de empleados/asistencia existentes...');
    await client.query('DELETE FROM descuento');
    await client.query('DELETE FROM marcacion');
    await client.query('DELETE FROM turno_jornada');
    await client.query('DELETE FROM novedad');
    await client.query('DELETE FROM visita_supervisor');
    await client.query('DELETE FROM enrolamiento_biometrico');
    await client.query('DELETE FROM dispositivo_empleado');
    await client.query('DELETE FROM liveness_reto');
    await client.query('DELETE FROM qr_token');
    await client.query('DELETE FROM empleado');

    console.log('Borrando áreas de prueba (smoke tests)...');
    const areasJunkRes = await client.query(
      `DELETE FROM turno_catalogo WHERE nombre = ANY($1) RETURNING nombre`,
      [AREAS_JUNK]
    );
    console.log(`  Eliminadas: ${areasJunkRes.rows.map((r) => r.nombre).join(', ') || '(ninguna)'}`);

    // ── Áreas reales + sucursales piloto + reglas de descuento ──
    const areasRes = await client.query(`
      SELECT tc.id, tc.nombre, tc.aplica_descuento,
             json_agg(json_build_object('numero_bloque', tb.numero_bloque,
               'hora_inicio', to_char(tb.hora_inicio,'HH24:MI'),
               'hora_fin', to_char(tb.hora_fin,'HH24:MI')) ORDER BY tb.numero_bloque) AS bloques
      FROM turno_catalogo tc
      JOIN turno_bloque tb ON tb.turno_catalogo_id = tc.id
      WHERE tc.activo = TRUE
      GROUP BY tc.id, tc.nombre, tc.aplica_descuento
    `);
    const areaPorNombre = Object.fromEntries(areasRes.rows.map((a) => [a.nombre, a]));
    const areaAdmin = areaPorNombre['Administración'];
    const areaManana = areaPorNombre['Sucursal-Mañana'];
    const areaTarde = areaPorNombre['TARDE'];
    if (!areaAdmin || !areaManana || !areaTarde) {
      throw new Error('Faltan las áreas reales esperadas (Administración / Sucursal-Mañana / TARDE). Abortando sin escribir nada.');
    }

    const sucRes = await client.query(
      `SELECT id, nombre, geo_lat, geo_lng, geo_radio_m FROM sucursal WHERE nombre = ANY($1)`,
      [SUCURSALES_PILOTO]
    );
    if (sucRes.rows.length !== 3) throw new Error('No se encontraron las 3 sucursales piloto esperadas.');
    const sucursales = SUCURSALES_PILOTO.map((n) => sucRes.rows.find((s) => s.nombre === n));

    const reglasRes = await client.query(`SELECT id, banda_min, banda_max, monto_bs FROM regla_descuento ORDER BY banda_min`);
    const reglas = reglasRes.rows.map((r) => ({ ...r, monto_bs: Number(r.monto_bs) }));

    // ── Definir plantilla de empleados ──
    let cursorNombre = 0;
    function siguienteNombre() {
      const [n, a] = NOMBRES_EMPLEADOS[cursorNombre % NOMBRES_EMPLEADOS.length];
      cursorNombre++;
      return [n, a];
    }

    const plantillaEmpleados = []; // { nombre, apellido, area, sucursal, esSupervisor }
    sucursales.forEach((suc) => {
      for (let i = 0; i < 4; i++) {
        const [n, a] = siguienteNombre();
        plantillaEmpleados.push({ nombre: n, apellido: a, area: areaManana, sucursal: suc });
      }
      for (let i = 0; i < 4; i++) {
        const [n, a] = siguienteNombre();
        plantillaEmpleados.push({ nombre: n, apellido: a, area: areaTarde, sucursal: suc });
      }
    });
    for (let i = 0; i < 6; i++) {
      const [n, a] = siguienteNombre();
      plantillaEmpleados.push({ nombre: n, apellido: a, area: areaAdmin, sucursal: sucursales[0] });
    }
    const supervisores = [];
    for (let i = 0; i < 2; i++) {
      const [n, a] = siguienteNombre();
      supervisores.push({ nombre: n, apellido: a });
    }

    console.log(`Creando ${plantillaEmpleados.length} empleados + ${supervisores.length} supervisores...`);
    const filasEmpleados = plantillaEmpleados.map((e, idx) => [
      e.nombre, e.apellido, `CI-${randInt(1000000, 9999999)}-${idx + 1}`,
      e.area.id, `7${randInt(1000000, 9999999)}`, false,
    ]);
    const idsEmpleados = await insertarLote(
      client, 'empleado',
      ['nombre', 'apellido', 'documento_nro', 'area_turno_id', 'telefono', 'es_supervisor'],
      filasEmpleados
    );
    plantillaEmpleados.forEach((e, i) => { e.id = idsEmpleados[i]; });

    const filasSupervisores = supervisores.map((s, idx) => [
      s.nombre, s.apellido, `CI-${randInt(1000000, 9999999)}-SUP${idx + 1}`,
      `7${randInt(1000000, 9999999)}`, true,
    ]);
    const idsSupervisores = await insertarLote(
      client, 'empleado',
      ['nombre', 'apellido', 'documento_nro', 'telefono', 'es_supervisor'],
      filasSupervisores
    );
    supervisores.forEach((s, i) => { s.id = idsSupervisores[i]; });

    // ── Generar 3 meses de asistencia ──
    const hoy = new Date();
    const fechas = [];
    for (let d = DIAS_HISTORIA; d >= 1; d--) {
      const f = new Date(hoy);
      f.setDate(f.getDate() - d);
      fechas.push({ y: f.getFullYear(), m: f.getMonth() + 1, d: f.getDate(), dow: f.getDay() });
    }

    // Día libre fijo por empleado de sucursal (staffing escalonado), 0=domingo.
    plantillaEmpleados.forEach((e, idx) => { e.diaLibre = idx % 7; });

    const jornadasPendientes = []; // { empleadoId, sucursalId, areaId, fecha, estadoFinal, marcaciones: [...] }
    const novedadesPendientes = []; // [empleadoId, fecha, tipo, nota]

    for (const emp of plantillaEmpleados) {
      const esAdmin = emp.area.nombre === 'Administración';
      for (const f of fechas) {
        const fecha = fechaISO(f.y, f.m, f.d);
        const finde = f.dow === 0 || f.dow === 6;
        if (esAdmin && finde) continue; // oficina no abre fines de semana
        if (!esAdmin && f.dow === emp.diaLibre) continue; // día libre semanal fijo

        // Ausencia extra ocasional (además del día libre).
        if (Math.random() < 0.035) {
          if (Math.random() < 0.6) {
            const tipo = Math.random() < 0.5 ? 'baja_medica' : 'permiso';
            novedadesPendientes.push([emp.id, fecha, tipo, tipo === 'baja_medica' ? 'Certificado médico presentado' : 'Permiso personal autorizado']);
          }
          continue; // sin jornada ese día (falta, justificada o no)
        }

        const bloques = esAdmin ? emp.area.bloques : [emp.area.bloques[0]];
        for (const bloque of bloques) {
          const offsetEntrada = generarOffsetEntrada();
          const atraso = offsetEntrada > 0 ? offsetEntrada : null;
          const horaEntrada = sumarMinutos(bloque.hora_inicio, offsetEntrada);
          const tsEntrada = utcDesdeLocal(f.y, f.m, f.d, horaEntrada.h, horaEntrada.m);

          const faltaSalida = Math.random() < 0.04;
          let tsSalida = null;
          if (!faltaSalida) {
            const offsetSalida = randInt(-15, 20);
            const horaSalida = sumarMinutos(bloque.hora_fin, offsetSalida);
            tsSalida = utcDesdeLocal(f.y, f.m, f.d, horaSalida.h, horaSalida.m);
          }

          jornadasPendientes.push({
            empleadoId: emp.id, sucursalId: emp.sucursal.id, areaId: emp.area.id, fecha,
            aplicaDescuento: emp.area.aplica_descuento,
            atraso, tsEntrada, tsSalida,
            sucursal: emp.sucursal,
          });
        }
      }
    }

    console.log(`Insertando ${jornadasPendientes.length} jornadas...`);
    const filasJornada = jornadasPendientes.map((j) => [
      j.empleadoId, j.sucursalId, j.fecha, j.areaId,
      'CERRADO', j.tsSalida === null, !j.tsSalida, j.tsSalida === null,
    ]);
    const idsJornada = await insertarLote(
      client, 'turno_jornada',
      ['empleado_id', 'sucursal_id', 'fecha', 'turno_catalogo_id', 'estado', 'cierre_automatico', 'salida_marcada', 'requiere_revision'],
      filasJornada
    );
    jornadasPendientes.forEach((j, i) => { j.id = idsJornada[i]; });

    console.log('Insertando marcaciones...');
    const filasMarcacion = []; // guardamos también { atraso, aplicaDescuento } aparte para el paso de descuentos
    const metaMarcacion = [];
    for (const j of jornadasPendientes) {
      const atrasoExcesivo = j.atraso != null && j.atraso > 60;
      const estadoEntrada = atrasoExcesivo ? 'requiere_revision' : 'registrada';
      filasMarcacion.push([
        j.empleadoId, j.id, j.sucursalId, `mock-device-${j.empleadoId}`, 'ENTRADA', j.tsEntrada,
        j.sucursal.geo_lat, j.sucursal.geo_lng, randInt(8, 25), true,
        j.sucursal.geo_lat, j.sucursal.geo_lng, j.sucursal.geo_radio_m,
        `https://mock.local/selfies/${j.empleadoId}-${j.fecha}-entrada.jpg`, true,
        (randInt(80, 98) / 100).toFixed(4), true, j.atraso, estadoEntrada, false,
      ]);
      metaMarcacion.push({ tipo: 'ENTRADA', jornada: j });

      if (j.tsSalida) {
        filasMarcacion.push([
          j.empleadoId, j.id, j.sucursalId, `mock-device-${j.empleadoId}`, 'SALIDA', j.tsSalida,
          j.sucursal.geo_lat, j.sucursal.geo_lng, randInt(8, 25), true,
          j.sucursal.geo_lat, j.sucursal.geo_lng, j.sucursal.geo_radio_m,
          `https://mock.local/selfies/${j.empleadoId}-${j.fecha}-salida.jpg`, true,
          (randInt(80, 98) / 100).toFixed(4), true, null, 'registrada', false,
        ]);
        metaMarcacion.push({ tipo: 'SALIDA', jornada: j });
      }
    }
    const columnasMarcacion = [
      'empleado_id', 'turno_jornada_id', 'sucursal_id', 'device_token', 'tipo', 'timestamp_utc',
      'gps_lat', 'gps_lng', 'gps_precision_m', 'dentro_geocerca',
      'geo_centro_lat_aplicado', 'geo_centro_lng_aplicado', 'geo_radio_aplicado',
      'selfie_url', 'liveness_ok', 'face_match_score', 'identidad_verificada',
      'minutos_atraso', 'estado', 'offline_mode',
    ];
    const idsMarcacion = await insertarLote(client, 'marcacion', columnasMarcacion, filasMarcacion);
    metaMarcacion.forEach((m, i) => { m.marcacionId = idsMarcacion[i]; });

    console.log('Insertando descuentos por atraso...');
    const filasDescuento = [];
    for (const m of metaMarcacion) {
      if (m.tipo !== 'ENTRADA') continue;
      const j = m.jornada;
      if (!j.aplicaDescuento) continue;
      const banda = bandaParaAtraso(j.atraso, reglas);
      if (!banda || banda.monto_bs <= 0) continue;
      filasDescuento.push([m.marcacionId, j.empleadoId, banda.monto_bs, banda.id, j.fecha.slice(0, 7), 'aplicado']);
    }
    await insertarLote(client, 'descuento', ['marcacion_id', 'empleado_id', 'monto_bs', 'regla_id', 'periodo', 'estado'], filasDescuento);

    if (novedadesPendientes.length) {
      console.log(`Insertando ${novedadesPendientes.length} novedades (bajas médicas / permisos)...`);
      // registrado_por: primer usuario rrhh_admin.
      const adminRes = await client.query(`SELECT id FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'rrhh_admin') LIMIT 1`);
      const adminId = adminRes.rows[0]?.id ?? null;
      const filasNovedad = novedadesPendientes.map(([empId, fecha, tipo, nota]) => [empId, fecha, tipo, nota, adminId]);
      await insertarLote(client, 'novedad', ['empleado_id', 'fecha', 'tipo', 'nota', 'registrado_por'], filasNovedad);
    }

    console.log('Insertando visitas de supervisor...');
    const filasVisita = [];
    for (const sup of supervisores) {
      for (const f of fechas) {
        if (f.dow === 0) continue; // domingo no visitan
        if (Math.random() > 0.35) continue; // ~2-3 visitas/semana
        const suc = pick(sucursales);
        const ts = utcDesdeLocal(f.y, f.m, f.d, randInt(9, 19), randInt(0, 59));
        filasVisita.push([sup.id, suc.id, ts, suc.geo_lat, suc.geo_lng, true]);
      }
    }
    await insertarLote(client, 'visita_supervisor', ['empleado_id', 'sucursal_id', 'timestamp_utc', 'gps_lat', 'gps_lng', 'dentro_geocerca'], filasVisita);

    await client.query('COMMIT');

    console.log('\n¡Listo!');
    console.log(`Empleados: ${plantillaEmpleados.length + supervisores.length} (${supervisores.length} supervisores)`);
    console.log(`Jornadas: ${jornadasPendientes.length}`);
    console.log(`Marcaciones: ${filasMarcacion.length}`);
    console.log(`Descuentos generados: ${filasDescuento.length}`);
    console.log(`Novedades: ${novedadesPendientes.length}`);
    console.log(`Visitas de supervisor: ${filasVisita.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error, se revirtió todo:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
