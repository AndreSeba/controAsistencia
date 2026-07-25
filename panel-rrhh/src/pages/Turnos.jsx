import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import { IconGuardar, IconCrear, IconEditar, IconEliminar, IconCancelar } from '../components/Icons';

const BLOQUE_VACIO = { horaInicio: '', horaFin: '' };

// Un área tiene 1 bloque (horario corrido) o 2 (con corte al mediodía, p.ej.
// Administración 08:00-12:00 / 14:30-18:30). El checkbox "Horario discontinuo"
// revela directamente los 2 pares de campos — más claro para RRHH que un botón
// genérico de "agregar bloque" que no explica para qué sirve.
function BloqueInputs({ bloques, onChange }) {
  const discontinuo = bloques.length > 1;

  function actualizarBloque(i, campo, valor) {
    const nuevos = bloques.map((b, idx) =>
      idx === i ? { ...b, [campo]: valor } : b
    );
    onChange(nuevos);
  }

  function alternarDiscontinuo(marcado) {
    if (marcado) {
      onChange([bloques[0] ?? BLOQUE_VACIO, BLOQUE_VACIO]);
    } else {
      onChange([bloques[0] ?? BLOQUE_VACIO]);
    }
  }

  function campoBloque(i, etiquetaEntrada, etiquetaSalida) {
    const b = bloques[i] ?? BLOQUE_VACIO;
    return (
      <div className="bloque-fila">
        <label className="campo campo-inline">
          {etiquetaEntrada}
          <input
            type="time"
            value={b.horaInicio}
            onChange={(e) => actualizarBloque(i, 'horaInicio', e.target.value)}
            required
          />
        </label>
        <label className="campo campo-inline">
          {etiquetaSalida}
          <input
            type="time"
            value={b.horaFin}
            onChange={(e) => actualizarBloque(i, 'horaFin', e.target.value)}
            required
          />
        </label>
      </div>
    );
  }

  return (
    <div className="bloques-horario">
      {campoBloque(0, discontinuo ? 'Entrada mañana' : 'Entrada', discontinuo ? 'Salida almuerzo' : 'Salida')}

      <label className="campo campo-toggle campo-discontinuo">
        <input
          type="checkbox"
          checked={discontinuo}
          onChange={(e) => alternarDiscontinuo(e.target.checked)}
        />
        Horario discontinuo (con corte al mediodía)
      </label>

      {discontinuo && campoBloque(1, 'Entrada tarde', 'Salida tarde')}
    </div>
  );
}

function formatearBloques(bloques) {
  if (!bloques || bloques.length === 0) return '—';
  return bloques.map((b) => `${b.hora_inicio}–${b.hora_fin}`).join('  /  ');
}

function Turnos() {
  const { request } = useAuth();
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [formBloques, setFormBloques] = useState([{ horaInicio: '', horaFin: '' }]);
  const [formDescuento, setFormDescuento] = useState(true);
  const [modalNueva, setModalNueva] = useState(false);
  const [formNueva, setFormNueva] = useState({ nombre: '', bloques: [{ horaInicio: '', horaFin: '' }], aplicaDescuento: true });
  const [errorModal, setErrorModal] = useState(null);
  const [margen, setMargen] = useState('');
  const [pagoDia, setPagoDia] = useState('');
  const [configGuardada, setConfigGuardada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [areaAEliminar, setAreaAEliminar] = useState(null);
  // Refs además del state: el atributo disabled del DOM se actualiza recién en el
  // próximo render de React, y 2 clicks muy rápidos (o dobleclick) pueden ocurrir
  // ambos ANTES de ese render — el estado por sí solo no alcanza para bloquear el
  // segundo submit. El ref es síncrono, se lee/escribe antes de cualquier await.
  const guardandoRef = useRef(false);
  const creandoRef = useRef(false);
  const guardandoConfigRef = useRef(false);

  const { datosPaginados, paginaActiva, totalPaginas, irPaginaSiguiente, irPaginaAnterior } = usePaginacion(areas, 10);

  async function cargar() {
    try {
      const [listaAreas, configuracion] = await Promise.all([
        request('/turnos'),
        request('/configuracion'),
      ]);
      setAreas(listaAreas);
      setMargen(String(configuracion.margenAnticipacionMin));
      setPagoDia(String(configuracion.pagoDiaBs));
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  function abrirEdicion(area) {
    setEditandoId(area.id);
    setNombreEdit(area.nombre);
    setErrorModal(null);
    // Convertir bloques del API (hora_inicio/hora_fin) al formato del form (horaInicio/horaFin).
    const bloquesForm = (area.bloques || []).map((b) => ({
      horaInicio: b.hora_inicio,
      horaFin: b.hora_fin,
    }));
    setFormBloques(bloquesForm.length > 0 ? bloquesForm : [{ horaInicio: '', horaFin: '' }]);
    setFormDescuento(area.aplica_descuento !== false);
  }

  async function guardar(e) {
    e.preventDefault();
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setErrorModal(null);
    setGuardando(true);
    try {
      await request(`/turnos/${editandoId}`, {
        method: 'PUT',
        body: { nombre: nombreEdit, bloques: formBloques, aplicaDescuento: formDescuento },
      });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  function abrirNueva() {
    setFormNueva({ nombre: '', bloques: [{ horaInicio: '', horaFin: '' }], aplicaDescuento: true });
    setErrorModal(null);
    setModalNueva(true);
  }

  async function crearArea(e) {
    e.preventDefault();
    if (creandoRef.current) return;
    creandoRef.current = true;
    setErrorModal(null);
    setGuardando(true);
    try {
      await request('/turnos', { method: 'POST', body: formNueva });
      setModalNueva(false);
      cargar();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      creandoRef.current = false;
      setGuardando(false);
    }
  }

  async function confirmarEliminarArea() {
    const area = areaAEliminar;
    setAreaAEliminar(null);
    setError(null);
    try {
      await request(`/turnos/${area.id}`, { method: 'DELETE' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarConfig(e) {
    e.preventDefault();
    if (guardandoConfigRef.current) return;
    guardandoConfigRef.current = true;
    setError(null);
    setConfigGuardada(false);
    setGuardandoConfig(true);
    try {
      await request('/configuracion', {
        method: 'PUT',
        body: { margenAnticipacionMin: Number(margen), pagoDiaBs: Number(pagoDia) },
      });
      setConfigGuardada(true);
    } catch (err) {
      setError(err.message);
    } finally {
      guardandoConfigRef.current = false;
      setGuardandoConfig(false);
    }
  }

  return (
    <div className="page">
      <h1>Áreas y horarios</h1>
      <p className="subtitulo">
        Cada área tiene su propio horario (con uno o más bloques). Al personal se le asigna un área al registrarlo,
        y su atraso se calcula contra el horario del bloque correspondiente.
      </p>
      {error && <p className="error">{error}</p>}

      <button type="button" className="boton-nuevo boton-icono" title="Nueva área" aria-label="Nueva área" onClick={abrirNueva}><IconCrear /></button>

      <table className="tabla">
        <thead>
          <tr><th>Área</th><th>Horario</th><th>Descuento</th><th></th></tr>
        </thead>
        <tbody>
          {datosPaginados.map((t) => (
            <tr key={t.id}>
              <td>{t.nombre}</td>
              <td>{formatearBloques(t.bloques)}</td>
              <td>
                <span className={`badge ${t.aplica_descuento ? 'badge-activo' : 'badge-inactivo'}`}>
                  {t.aplica_descuento ? 'Sí' : 'No'}
                </span>
              </td>
              <td>
                <button type="button" className="boton-icono" title="Editar" aria-label="Editar" onClick={() => abrirEdicion(t)}><IconEditar /></button>
                <button type="button" className="boton-icono" title="Eliminar" aria-label="Eliminar" onClick={() => setAreaAEliminar(t)}><IconEliminar /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Paginacion
        paginaActiva={paginaActiva}
        totalPaginas={totalPaginas}
        irPaginaAnterior={irPaginaAnterior}
        irPaginaSiguiente={irPaginaSiguiente}
      />

      <Modal
        abierto={editandoId != null}
        titulo={`Editar — ${areas.find((t) => t.id === editandoId)?.nombre ?? ''}`}
        onCerrar={() => setEditandoId(null)}
      >
        <form onSubmit={guardar}>
          {errorModal && <p className="error alerta-modal">{errorModal}</p>}
          <label className="campo">
            Nombre del área
            <input
              placeholder="Cocina, Reparto, Administración…"
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              maxLength={20}
              required
            />
          </label>
          <BloqueInputs bloques={formBloques} onChange={setFormBloques} />
          <label className="campo campo-toggle">
            <input
              type="checkbox"
              checked={formDescuento}
              onChange={(e) => setFormDescuento(e.target.checked)}
            />
            Aplica descuento por atraso
          </label>
          <button type="submit" className="boton-icono" title="Guardar" aria-label="Guardar" disabled={guardando}><IconGuardar /></button>
          <button type="button" className="boton-icono" title="Cancelar" aria-label="Cancelar" onClick={() => setEditandoId(null)} disabled={guardando}><IconCancelar /></button>
        </form>
      </Modal>

      <Modal abierto={modalNueva} titulo="Nueva área" onCerrar={() => setModalNueva(false)}>
        <form onSubmit={crearArea}>
          {errorModal && <p className="error alerta-modal">{errorModal}</p>}
          <label className="campo">
            Nombre del área
            <input
              placeholder="Cocina, Reparto, Administración…"
              value={formNueva.nombre}
              onChange={(e) => setFormNueva({ ...formNueva, nombre: e.target.value })}
              maxLength={20}
              required
            />
          </label>
          <BloqueInputs
            bloques={formNueva.bloques}
            onChange={(bloques) => setFormNueva({ ...formNueva, bloques })}
          />
          <label className="campo campo-toggle">
            <input
              type="checkbox"
              checked={formNueva.aplicaDescuento}
              onChange={(e) => setFormNueva({ ...formNueva, aplicaDescuento: e.target.checked })}
            />
            Aplica descuento por atraso
          </label>
          <button type="submit" className="boton-icono" title="Crear" aria-label="Crear" disabled={guardando}><IconCrear /></button>
          <button type="button" className="boton-icono" title="Cancelar" aria-label="Cancelar" onClick={() => setModalNueva(false)} disabled={guardando}><IconCancelar /></button>
        </form>
      </Modal>

      <div className="card">
        <h2>Parámetros generales</h2>
        <p className="subtitulo" style={{ marginTop: 0 }}>
          El margen de anticipación no bloquea a nadie: lo que marque más temprano que el
          margen queda para revisión. El pago por día alimenta la planilla quincenal.
        </p>
        <form className="form-inline" onSubmit={guardarConfig}>
          <label className="campo">
            Margen de anticipación (min)
            <input
              type="number"
              min="0"
              max="240"
              value={margen}
              onChange={(e) => { setMargen(e.target.value); setConfigGuardada(false); }}
              required
            />
          </label>
          <label className="campo">
            Pago por día trabajado (Bs)
            <input
              type="number"
              min="0"
              step="0.5"
              value={pagoDia}
              onChange={(e) => { setPagoDia(e.target.value); setConfigGuardada(false); }}
              required
            />
          </label>
          <button type="submit" className="boton-icono" title={guardandoConfig ? 'Guardando…' : 'Guardar'} aria-label="Guardar" disabled={guardandoConfig}><IconGuardar /></button>
          {configGuardada && <span className="ayuda">Guardado.</span>}
        </form>
      </div>

      <ConfirmDialog
        abierto={areaAEliminar != null}
        titulo="Eliminar área"
        mensaje={areaAEliminar && `¿Eliminar el área "${areaAEliminar.nombre}"? No se puede deshacer desde el panel; si tiene personal activo asignado, primero hay que reasignarlo.`}
        onConfirmar={confirmarEliminarArea}
        onCancelar={() => setAreaAEliminar(null)}
      />
    </div>
  );
}

export default Turnos;
