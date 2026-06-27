const app = require('./app');
const autoCierreJornadasJob = require('./jobs/autoCierreJornadas.job');

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`control-asistencia backend escuchando en :${port}`);
  autoCierreJornadasJob.iniciar();
});
