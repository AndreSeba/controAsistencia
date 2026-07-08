// Íconos de línea minimalistas (mismo estilo que el menú lateral): sin relleno,
// trazo currentColor, 24x24 de base. Nada de emoji — solo SVG monocromo.
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconGuardar(props) {
  return (
    <svg {...base} {...props}><path d="M20 6 9 17l-5-5" /></svg>
  );
}

export function IconCrear(props) {
  return (
    <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>
  );
}

export function IconEditar(props) {
  return (
    <svg {...base} {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
  );
}

export function IconEliminar(props) {
  return (
    <svg {...base} {...props}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
  );
}

export function IconCancelar(props) {
  return (
    <svg {...base} {...props}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
  );
}

export function IconDescargar(props) {
  return (
    <svg {...base} {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
  );
}

export function IconCopiar(props) {
  return (
    <svg {...base} {...props}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  );
}

export function IconDispositivo(props) {
  return (
    <svg {...base} {...props}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg>
  );
}

export function IconCamara(props) {
  return (
    <svg {...base} {...props}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></svg>
  );
}

export function IconActualizar(props) {
  return (
    <svg {...base} {...props}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
  );
}

export function IconVolver(props) {
  return (
    <svg {...base} {...props}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
  );
}
