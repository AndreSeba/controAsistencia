const turnosRepo = require('../repositories/turnos.repository');

const INTERVALO_MS = 5 * 60 * 1000;

// P8: jornadas ABIERTAS cuya hora_fin de turno ya pasó se cierran solas. Nunca se
// inventa una marcación de SALIDA — solo se cierra la jornada con requiere_revision=1
// para que RRHH la revise.
async function correr() {
  try {
    const vencidas = await turnosRepo.listarAbiertasVencidas();
    for (const jornada of vencidas) {
      await turnosRepo.cerrar(jornada.id, {
        salidaMarcada: false,
        cierreAutomatico: true,
        requiereRevision: true,
      });
    }
  } catch (err) {
    console.error('Error en job autoCierreJornadas:', err);
  }
}

function iniciar() {
  correr();
  setInterval(correr, INTERVALO_MS);
}

module.exports = { iniciar, correr };
