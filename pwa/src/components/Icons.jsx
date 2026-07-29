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

export function IconPersonas(props) {
  return (
    <svg {...base} {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  );
}

// El ícono de "compartir" de iOS: cuadrado con una flecha saliendo hacia arriba —
// se usa en el aviso de instalación porque es literalmente el botón que hay que tocar.
export function IconCompartirIOS(props) {
  return (
    <svg {...base} {...props}><path d="M12 16V4" /><path d="m8 8 4-4 4 4" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" /></svg>
  );
}

export function IconCerrar(props) {
  return (
    <svg {...base} {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  );
}
