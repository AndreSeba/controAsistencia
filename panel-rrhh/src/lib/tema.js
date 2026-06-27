const CLAVE = 'panel-rrhh-tema';

function obtenerTema() {
  return localStorage.getItem(CLAVE) || 'claro';
}

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem(CLAVE, tema);
}

function alternarTema() {
  const nuevo = obtenerTema() === 'oscuro' ? 'claro' : 'oscuro';
  aplicarTema(nuevo);
  return nuevo;
}

export { obtenerTema, aplicarTema, alternarTema };
