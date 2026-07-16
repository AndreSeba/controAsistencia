import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { urlActivacion } from '../lib/urlPantalla';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import {
  IconGuardar, IconCrear, IconCancelar, IconCopiar, IconEditar, IconEliminar, IconPersonas,
} from '../components/Icons';

// Celular corporativo compartido: reemplaza la propuesta "marcación por CI sin celular".
// Varios empleados sin teléfono propio marcan desde el MISMO dispositivo, habilitados uno
// por uno por RRHH — con selfie/liveness/face-match reales (el teléfono tiene cámara),
// a diferencia de un formulario de CI sin biometría.
function DispositivosCorporativos() {
  const { request } = useAuth();
  const [dispositivos, setDispositivos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(null); // 'crear' | 'sucursal' | 'empleados' | null
  const [editandoId, setEditandoId] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaSucursalId, setNuevaSucursalId] = useState('');
  const [sucursalReasignar, setSucursalReasignar] = useState('');
  const [tokenEmitido, setTokenEmitido] = useState(null);
  const [idCopiado, setIdCopiado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);

  const [habilitados, setHabilitados] = useState([]);
  const [empleadoAHabilitar, setEmpleadoAHabilitar] = useState('');
  const [dispositivoARevocar, setDispositivoARevocar] = useState(null);
  const [habilitacionARevocar, setHabilitacionARevocar] = useState(null);

  const { datosPaginados, paginaActiva, totalPaginas, irPaginaSiguiente, irPaginaAnterior } = usePaginacion(dispositivos, 10);

  async function cargar() {
    try {
      const [listaDispositivos, listaSucursales, listaEmpleados] = await Promise.all([
        request('/dispositivos-corporativos'),
        request('/sucursales'),
        request('/empleados'),
      ]);
      setDispositivos(listaDispositivos);
      setSucursales(listaSucursales);
      setEmpleados(listaEmpleados);
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setNuevoNombre('');
    setNuevaSucursalId('');
    setModalAbierto('crear');
  }

  async function crear(e) {
    e.preventDefault();
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setError(null);
    setGuardando(true);
    try {
      const resultado = await request('/dispositivos-corporativos', {
        method: 'POST',
        body: { nombre: nuevoNombre, sucursalId: Number(nuevaSucursalId) },
      });
      setTokenEmitido(resultado.deviceToken);
      setModalAbierto(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  async function copiarEnlace(dispositivo) {
    setError(null);
    try {
      const { deviceToken } = await request(`/dispositivos-corporativos/${dispositivo.id}/enlace`);
      await navigator.clipboard.writeText(urlActivacion(deviceToken));
      setIdCopiado(dispositivo.id);
      setTimeout(() => setIdCopiado(null), 2000);
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirReasignar(dispositivo) {
    setEditandoId(dispositivo.id);
    setSucursalReasignar(String(dispositivo.sucursal_id));
    setModalAbierto('sucursal');
  }

  async function guardarReasignacion(e) {
    e.preventDefault();
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setError(null);
    setGuardando(true);
    try {
      await request(`/dispositivos-corporativos/${editandoId}/sucursal`, {
        method: 'PUT',
        body: { sucursalId: Number(sucursalReasignar) },
      });
      setModalAbierto(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  async function confirmarRevocarDispositivo() {
    const id = dispositivoARevocar.id;
    setDispositivoARevocar(null);
    setError(null);
    try {
      await request(`/dispositivos-corporativos/${id}`, { method: 'DELETE' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function abrirEmpleados(dispositivo) {
    setEditandoId(dispositivo.id);
    setEmpleadoAHabilitar('');
    setModalAbierto('empleados');
    await cargarHabilitados(dispositivo.id);
  }

  async function cargarHabilitados(dispositivoId) {
    try {
      setHabilitados(await request(`/dispositivos-corporativos/${dispositivoId}/empleados`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function habilitarEmpleado(e) {
    e.preventDefault();
    if (!empleadoAHabilitar || guardandoRef.current) return;
    guardandoRef.current = true;
    setError(null);
    try {
      await request(`/dispositivos-corporativos/${editandoId}/empleados`, {
        method: 'POST',
        body: { empleadoId: Number(empleadoAHabilitar) },
      });
      setEmpleadoAHabilitar('');
      await cargarHabilitados(editandoId);
    } catch (err) {
      setError(err.message);
    } finally {
      guardandoRef.current = false;
    }
  }

  async function confirmarDeshabilitar() {
    const { dispositivoId, habilitacionId } = habilitacionARevocar;
    setHabilitacionARevocar(null);
    setError(null);
    try {
      await request(`/dispositivos-corporativos/${dispositivoId}/empleados/${habilitacionId}`, { method: 'DELETE' });
      await cargarHabilitados(dispositivoId);
    } catch (err) {
      setError(err.message);
    }
  }

  const empleadosNoHabilitados = empleados.filter(
    (emp) => !habilitados.some((h) => h.empleado_id === emp.id)
  );

  return (
    <div className="page">
      <h1>Dispositivos corporativos</h1>
      <p className="subtitulo">
        Celulares compartidos (ej. el que usa la sucursal para pedidos) desde los que puede marcar
        el personal sin teléfono propio, uno por uno habilitado por RRHH. La identidad se sigue
        verificando con selfie y reconocimiento facial — no es un camino sin cámara.
      </p>
      {error && <p className="error">{error}</p>}
      {tokenEmitido && (
        <p className="aviso">
          Código de activación (transmitir por canal seguro, no se volverá a mostrar):{' '}
          <code>{tokenEmitido}</code>
        </p>
      )}

      <button type="button" className="boton-nuevo boton-icono" title="Nuevo dispositivo corporativo" aria-label="Nuevo dispositivo corporativo" onClick={abrirCrear}><IconCrear /></button>

      <table className="tabla">
        <thead>
          <tr>
            <th>Nombre</th><th>Sucursal</th><th>Estado</th><th>Enlace de activación</th><th></th>
          </tr>
        </thead>
        <tbody>
          {datosPaginados.map((d) => (
            <tr key={d.id}>
              <td>{d.nombre}</td>
              <td>{d.sucursal_nombre}</td>
              <td>{d.estado === 'activo' ? 'Activo' : 'Revocado'}</td>
              <td>
                <span className="enlace-copiable">
                  <button type="button" className="boton-icono" title="Copiar enlace" aria-label="Copiar enlace" onClick={() => copiarEnlace(d)}><IconCopiar /></button>
                  {idCopiado === d.id && <span className="enlace-copiado">Copiado ✓</span>}
                </span>
              </td>
              <td>
                <button type="button" className="boton-icono" title="Empleados habilitados" aria-label="Empleados habilitados" onClick={() => abrirEmpleados(d)}><IconPersonas /></button>
                <button type="button" className="boton-icono" title="Reasignar sucursal" aria-label="Reasignar sucursal" onClick={() => abrirReasignar(d)}><IconEditar /></button>
                {d.estado === 'activo' && (
                  <button type="button" className="boton-icono" title="Revocar" aria-label="Revocar" onClick={() => setDispositivoARevocar(d)}><IconEliminar /></button>
                )}
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

      <Modal abierto={modalAbierto === 'crear'} titulo="Nuevo dispositivo corporativo" onCerrar={() => setModalAbierto(null)}>
        <form onSubmit={crear}>
          <label className="campo">
            Nombre (ej. "Celular pedidos - Sucursal Norte")
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
          </label>
          <label className="campo">
            Sucursal
            <select value={nuevaSucursalId} onChange={(e) => setNuevaSucursalId(e.target.value)} required>
              <option value="">Elegir sucursal</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <span className="ayuda">El dispositivo solo va a poder marcar en esta sucursal — no es una señal blanda como el GPS.</span>
          </label>
          <button type="submit" className="boton-icono" title="Crear dispositivo" aria-label="Crear dispositivo" disabled={guardando}><IconGuardar /></button>
          <button type="button" className="boton-icono" title="Cancelar" aria-label="Cancelar" onClick={() => setModalAbierto(null)} disabled={guardando}><IconCancelar /></button>
        </form>
      </Modal>

      <Modal
        abierto={modalAbierto === 'sucursal'}
        titulo={`Reasignar sucursal — ${dispositivos.find((d) => d.id === editandoId)?.nombre ?? ''}`}
        onCerrar={() => setModalAbierto(null)}
      >
        <form onSubmit={guardarReasignacion}>
          <label className="campo">
            Sucursal
            <select value={sucursalReasignar} onChange={(e) => setSucursalReasignar(e.target.value)} required>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton-icono" title="Guardar cambios" aria-label="Guardar cambios" disabled={guardando}><IconGuardar /></button>
          <button type="button" className="boton-icono" title="Cancelar" aria-label="Cancelar" onClick={() => setModalAbierto(null)} disabled={guardando}><IconCancelar /></button>
        </form>
      </Modal>

      <Modal
        abierto={modalAbierto === 'empleados'}
        titulo={`Empleados habilitados — ${dispositivos.find((d) => d.id === editandoId)?.nombre ?? ''}`}
        onCerrar={() => setModalAbierto(null)}
      >
        <form onSubmit={habilitarEmpleado} className="campo-inline">
          <select value={empleadoAHabilitar} onChange={(e) => setEmpleadoAHabilitar(e.target.value)}>
            <option value="">Elegir empleado para habilitar</option>
            {empleadosNoHabilitados.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellido}</option>
            ))}
          </select>
          <button type="submit" className="boton-icono" title="Habilitar" aria-label="Habilitar" disabled={!empleadoAHabilitar}><IconCrear /></button>
        </form>

        <ul className="lista-simple">
          {habilitados.length === 0 && <li>Todavía no hay empleados habilitados en este dispositivo.</li>}
          {habilitados.map((h) => (
            <li key={h.habilitacion_id}>
              <span>{h.nombre} {h.apellido}{h.es_supervisor && ' (Supervisor)'}</span>
              <button type="button" onClick={() => setHabilitacionARevocar({ dispositivoId: editandoId, habilitacionId: h.habilitacion_id, nombreCompleto: `${h.nombre} ${h.apellido}` })}>
                <IconEliminar /> Deshabilitar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="boton-icono" title="Cerrar" aria-label="Cerrar" onClick={() => setModalAbierto(null)}><IconCancelar /></button>
      </Modal>

      <ConfirmDialog
        abierto={dispositivoARevocar != null}
        titulo="Revocar dispositivo corporativo"
        mensaje={dispositivoARevocar && `¿Revocar "${dispositivoARevocar.nombre}"? Ningún empleado va a poder marcar más desde este teléfono hasta enrolar uno nuevo.`}
        onConfirmar={confirmarRevocarDispositivo}
        onCancelar={() => setDispositivoARevocar(null)}
      />

      <ConfirmDialog
        abierto={habilitacionARevocar != null}
        titulo="Deshabilitar empleado"
        mensaje={habilitacionARevocar && `¿Ya no dejar que ${habilitacionARevocar.nombreCompleto} marque desde este dispositivo?`}
        onConfirmar={confirmarDeshabilitar}
        onCancelar={() => setHabilitacionARevocar(null)}
      />
    </div>
  );
}

export default DispositivosCorporativos;
