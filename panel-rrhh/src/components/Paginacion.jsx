function Paginacion({ paginaActiva, totalPaginas, irPaginaAnterior, irPaginaSiguiente }) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="paginacion">
      <button 
        type="button" 
        onClick={irPaginaAnterior} 
        disabled={paginaActiva === 1}
      >
        Anterior
      </button>
      <span>
        Página {paginaActiva} de {totalPaginas}
      </span>
      <button 
        type="button" 
        onClick={irPaginaSiguiente} 
        disabled={paginaActiva === totalPaginas}
      >
        Siguiente
      </button>
    </div>
  );
}

export default Paginacion;
