import Modal from './Modal';
import { IconEliminar, IconCancelar } from './Icons';

// Reemplaza window.confirm() por un modal centrado, con el mismo look del resto
// del panel — window.confirm() es el diálogo feo/nativo del navegador.
function ConfirmDialog({ abierto, titulo = 'Confirmar acción', mensaje, onConfirmar, onCancelar }) {
  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCancelar}>
      <p className="confirm-mensaje">{mensaje}</p>
      <div className="confirm-acciones">
        <button type="button" className="boton-peligro" onClick={onConfirmar}><IconEliminar /> Confirmar</button>
        <button type="button" onClick={onCancelar}><IconCancelar /> Cancelar</button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
