const { getPool } = require('../config/db');

async function registrar({ usuarioId, accion, tabla, registroId, ip, detalle }, executor = getPool()) {
  await executor.query(
    `INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, ip, detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuarioId, accion, tabla, String(registroId), ip, detalle ? JSON.stringify(detalle) : null]
  );
}

module.exports = { registrar };
