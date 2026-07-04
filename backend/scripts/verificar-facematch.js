// Prueba real del motor de face-match con fotos ya subidas al sistema (no sintéticas).
// Corre con: node --env-file=.env scripts/verificar-facematch.js
const fs = require('fs');
const path = require('path');
const cifradoService = require('../src/services/cifrado.service');
const faceMatchService = require('../src/services/faceMatch.service');

const DIR_BIOMETRIA = path.join(__dirname, '..', 'uploads', 'biometria');
const DIR_MARCACIONES = path.join(__dirname, '..', 'uploads', 'marcaciones');

async function main() {
  const referencia = fs.readFileSync(path.join(DIR_BIOMETRIA, '76d196be-f31a-42ce-a458-dc03f20eef15.jpg'));

  console.log('1) ¿Se detecta cara en la foto de enrolamiento?');
  const template = await faceMatchService.generarTemplate(referencia);
  console.log(`   Sí — descriptor de ${template.length} bytes (128 floats x 4 bytes) generado.\n`);

  // Simula el ciclo completo: cifrar en enrolamiento, descifrar al comparar.
  const templateCifrado = cifradoService.cifrar(template);
  const templateDescifrado = cifradoService.descifrar(templateCifrado);

  console.log('2) Autocomparación (misma foto) — control positivo, debería casi matchear 100%:');
  const auto = await faceMatchService.comparar(referencia, templateDescifrado);
  console.log(`   score=${auto.score.toFixed(4)} match=${auto.match}\n`);

  const candidatos = fs.readdirSync(DIR_MARCACIONES).filter(f => {
    const stat = fs.statSync(path.join(DIR_MARCACIONES, f));
    return stat.size > 5000; // descarta los placeholders de 1x1 (22-68 bytes)
  });

  console.log(`3) Comparación contra ${candidatos.length} selfies reales de marcaciones:`);
  for (const archivo of candidatos) {
    const buffer = fs.readFileSync(path.join(DIR_MARCACIONES, archivo));
    const resultado = await faceMatchService.comparar(buffer, templateDescifrado);
    console.log(`   ${archivo} (${buffer.length}b) → score=${resultado.score.toFixed(4)} match=${resultado.match}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
