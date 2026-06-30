import { useState } from 'react';

export function usePaginacion(datos, filasPorPagina = 10) {
  const [paginaActiva, setPaginaActiva] = useState(1);

  const totalPaginas = Math.ceil((datos?.length || 0) / filasPorPagina);
  const indiceUltimo = paginaActiva * filasPorPagina;
  const indicePrimero = indiceUltimo - filasPorPagina;
  const datosPaginados = (datos || []).slice(indicePrimero, indiceUltimo);

  function irPaginaSiguiente() {
    setPaginaActiva((p) => Math.min(p + 1, totalPaginas));
  }

  function irPaginaAnterior() {
    setPaginaActiva((p) => Math.max(p - 1, 1));
  }

  function setPagina(numero) {
    const numPag = Math.max(1, Math.min(numero, totalPaginas));
    setPaginaActiva(numPag);
  }

  return {
    paginaActiva,
    totalPaginas,
    datosPaginados,
    irPaginaSiguiente,
    irPaginaAnterior,
    setPagina,
  };
}
