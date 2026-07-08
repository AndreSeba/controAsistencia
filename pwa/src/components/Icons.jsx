// Íconos de línea minimalistas, sin emoji — trazo currentColor, 24x24 de base.
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconEntrada(props) {
  return (
    <svg {...base} {...props}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
  );
}

export function IconSalida(props) {
  return (
    <svg {...base} {...props}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
  );
}

export function IconVisita(props) {
  return (
    <svg {...base} {...props}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3" /><path d="M9 12h6M9 16h4" /></svg>
  );
}

export function IconGuardar(props) {
  return (
    <svg {...base} {...props}><path d="M20 6 9 17l-5-5" /></svg>
  );
}

export function IconVolver(props) {
  return (
    <svg {...base} {...props}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
  );
}
