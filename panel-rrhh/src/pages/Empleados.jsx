import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { urlActivacion } from '../lib/urlPantalla';
import { redimensionarFoto } from '../lib/redimensionarFoto';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import { IconGuardar, IconCrear, IconEditar, IconCancelar, IconCopiar, IconDispositivo, IconCamara } from '../components/Icons';

function Empleados() {
  const { request } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApellido, setNuevoApellido] = useState('');
  const [nuevoDocumentoNro, setNuevoDocumentoNro] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('activo');
  const [nuevaArea, setNuevaArea] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoEsSupervisor, setNuevoEsSupervisor] = useState(false);
  const [nuevaFechaIngreso, setNuevaFechaIngreso] = useState('');
  const [nuevaFechaRetiro, setNuevaFechaRetiro] = useState('');
  const [idCopiado, setIdCopiado] = useState(null);
  const [enlaceManual, setEnlaceManual] = useState(null); // { empleadoId, url } — fallback si el navegador bloquea el portapapeles
  const fotoInputRef = useRef(null);
  const [empleadoBiometriaId, setEmpleadoBiometriaId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [empleadoEditando, setEmpleadoEditando] = useState(null);
  const [nuevaFoto, setNuevaFoto] = useState(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [errorModal, setErrorModal] = useState(null); // errores del formulario, visibles DENTRO del modal
  const [dispositivoARevocar, setDispositivoARevocar] = useState(null); // { empleadoId, dispositivoId, nombreCompleto }

  const empleadosFiltrados = empleados.filter(emp => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    const full = `${emp.nombre} ${emp.apellido}`.toLowerCase();
    return full.includes(term) || emp.documento_nro?.toLowerCase().includes(term);
  });

  const { datosPaginados, paginaActiva, totalPaginas, irPaginaSiguiente, irPaginaAnterior, setPagina } = usePaginacion(empleadosFiltrados, 10);

  // Volver a página 1 si cambia la lista filtrada y quedamos "fuera"
  useEffect(() => {
    if (paginaActiva > totalPaginas && totalPaginas > 0) {
      setPagina(totalPaginas);
    }
  }, [totalPaginas, paginaActiva, setPagina]);

  async function cargar() {
    try {
      const [listaEmpleados, listaAreas] = await Promise.all([
        request('/empleados?incluirInactivos=true'),
        request('/turnos'),
      ]);
      setEmpleados(listaEmpleados);
      setAreas(listaAreas);
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  function limpiarFotoNueva() {
    setNuevaFoto(null);
    setFotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function abrirCrear() {
    setEmpleadoEditando(null);
    setNuevoNombre('');
    setNuevoApellido('');
    setNuevoDocumentoNro('');
    setNuevoEstado('activo');
    setNuevaArea('');
    setNuevoTelefono('');
    setNuevoEsSupervisor(false);
    setNuevaFechaIngreso('');
    setNuevaFechaRetiro('');
    limpiarFotoNueva();
    setErrorModal(null);
    setModalAbierto(true);
  }

  function abrirEditar(emp) {
    setEmpleadoEditando(emp);
    setNuevoNombre(emp.nombre);
    setNuevoApellido(emp.apellido);
    setNuevoDocumentoNro(emp.documento_nro);
    setNuevoEstado(emp.estado || 'activo');
    setNuevaArea(emp.area_turno_id != null ? String(emp.area_turno_id) : '');
    setNuevoTelefono(emp.telefono ?? '');
    setNuevoEsSupervisor(emp.es_supervisor === true);
    setNuevaFechaIngreso(emp.fecha_ingreso ? emp.fecha_ingreso.slice(0, 10) : '');
    setNuevaFechaRetiro(emp.fecha_retiro ? emp.fecha_retiro.slice(0, 10) : '');
    limpiarFotoNueva();
    setErrorModal(null);
    setModalAbierto(true);
  }

  function manejarNuevaFoto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setNuevaFoto(archivo);
    setFotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(archivo);
    });
  }

  async function guardar(e) {
    e.preventDefault();
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setError(null);
    setErrorModal(null);
    setGuardando(true);
    try {
      const datos = {
        nombre: nuevoNombre,
        apellido: nuevoApellido,
        documentoNro: nuevoDocumentoNro,
        estado: nuevoEstado,
        areaTurnoId: nuevaArea || null,
        telefono: nuevoTelefono,
        esSupervisor: nuevoEsSupervisor,
        fechaIngreso: nuevaFechaIngreso || null,
        fechaRetiro: nuevaFechaRetiro || null,
      };
      if (empleadoEditando) {
        await request(`/empleados/${empleadoEditando.id}`, { method: 'PUT', body: datos });
      } else {
        const creado = await request('/empleados', { method: 'POST', body: datos });
        if (nuevaFoto) {
          try {
            const fotoReducida = await redimensionarFoto(nuevaFoto);
            const formData = new FormData();
            formData.append('foto', fotoReducida, 'foto.jpg');
            await request(`/empleados/${creado.id}/biometria`, {
              method: 'POST',
              body: formData,
              isFormData: true,
            });
          } catch (errFoto) {
            // El personal ya se creó; la biometría se puede reintentar desde la fila
            // ("Enrolar biometría") sin perder el alta — no tiene sentido revertir todo.
            setModalAbierto(false);
            limpiarFotoNueva();
            cargar();
            setError(`Personal creado, pero la foto de biometría falló: ${errFoto.message} (reintentá desde "Enrolar biometría" en la fila).`);
            return;
          }
        }
      }
      setModalAbierto(false);
      limpiarFotoNueva();
      cargar();
    } catch (err) {
      // El modal sigue abierto: el error (p.ej. CI duplicado, 409) se muestra adentro,
      // no en la página de fondo donde el modal lo tapa.
      setErrorModal(err.message);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  // Copia el link al portapapeles; si el navegador la rechaza (pestaña sin foco,
  // contexto no seguro, permiso denegado), en vez de fallar en silencio mostramos el
  // enlace para copiarlo a mano. Compartido por enrolar (primera vez) y "Copiar
  // enlace" (reenvío) — las dos terminan en lo mismo: un link listo para mandar.
  async function copiarAlPortapapeles(empleadoId, url) {
    try {
      await navigator.clipboard.writeText(url);
      setIdCopiado(empleadoId);
      setTimeout(() => setIdCopiado(null), 2000);
    } catch {
      setEnlaceManual({ empleadoId, url });
    }
  }

  async function enrolarDispositivo(empleadoId) {
    setError(null);
    setEnlaceManual(null);
    try {
      const resultado = await request(`/empleados/${empleadoId}/dispositivo`, { method: 'POST' });
      await copiarAlPortapapeles(empleadoId, urlActivacion(resultado.activacionToken));
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function copiarEnlace(empleadoId) {
    setError(null);
    setEnlaceManual(null);
    try {
      const { activacionToken } = await request(`/empleados/${empleadoId}/dispositivo/enlace`);
      await copiarAlPortapapeles(empleadoId, urlActivacion(activacionToken));
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmarRevocarDispositivo() {
    const { empleadoId, dispositivoId } = dispositivoARevocar;
    setDispositivoARevocar(null);
    setError(null);
    try {
      await request(`/empleados/${empleadoId}/dispositivo/${dispositivoId}`, { method: 'DELETE' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirSelectorFoto(empleadoId) {
    setEmpleadoBiometriaId(empleadoId);
    fotoInputRef.current?.click();
  }

  async function manejarFotoSeleccionada(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo || !empleadoBiometriaId) return;
    setError(null);
    try {
      const fotoReducida = await redimensionarFoto(archivo);
      const formData = new FormData();
      formData.append('foto', fotoReducida, 'foto.jpg');
      await request(`/empleados/${empleadoBiometriaId}/biometria`, {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEmpleadoBiometriaId(null);
    }
  }

  return (
    <div className="page">
      <h1>Personal</h1>
      {error && <p className="error">{error}</p>}
      {enlaceManual && (
        <p className="aviso">
          No se pudo copiar automáticamente. Enlace para el personal #{enlaceManual.empleadoId}
          (seleccioná y copiá a mano): <code>{enlaceManual.url}</code>
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '16px' }}>
        <button type="button" className="boton-nuevo boton-icono" title="Agregar personal" aria-label="Agregar personal" onClick={abrirCrear}><IconCrear /></button>
        <input
          type="search"
          placeholder="Buscar por nombre o CI..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          style={{ padding: '8px', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>

      <input
        ref={fotoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={manejarFotoSeleccionada}
      />

      <table className="tabla">
        <thead>
          <tr>
            <th>Nombre</th><th>Apellido</th><th>Documento</th><th>Área</th><th>Teléfono</th><th>Estado</th><th>Acciones</th><th>Dispositivo</th><th>Biometría</th>
          </tr>
        </thead>
        <tbody>
          {datosPaginados.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nombre}{emp.es_supervisor && <span className="badge-supervisor" title="Supervisor de sucursales"> (Supervisor)</span>}</td>
              <td>{emp.apellido}</td>
              <td>{emp.documento_nro}</td>
              <td>{emp.area_nombre ?? '—'}</td>
              <td>{emp.telefono ?? '—'}</td>
              <td>{emp.estado}</td>
              <td>
                <button type="button" className="boton-icono" title="Editar" aria-label="Editar" onClick={() => abrirEditar(emp)}><IconEditar /></button>
              </td>
              <td>{emp.dispositivo_id ? 'Activo' : 'Sin enrolar'}</td>
              <td>{emp.biometria_id ? 'Activa' : 'Sin enrolar'}</td>
              <td>
                {emp.dispositivo_id ? (
                  <>
                    <button type="button" onClick={() => copiarEnlace(emp.id)}><IconCopiar /> Copiar enlace</button>
                    {idCopiado === emp.id && <span className="enlace-copiado">Copiado ✓</span>}
                    <button type="button" onClick={() => setDispositivoARevocar({ empleadoId: emp.id, dispositivoId: emp.dispositivo_id, nombreCompleto: `${emp.nombre} ${emp.apellido}` })}><IconCancelar /> Revocar dispositivo</button>
                  </>
                ) : (
                  <button type="button" onClick={() => enrolarDispositivo(emp.id)}><IconDispositivo /> Enrolar dispositivo</button>
                )}
                <button type="button" onClick={() => abrirSelectorFoto(emp.id)}>
                  <IconCamara /> {emp.biometria_id ? 'Re-enrolar biometría' : 'Enrolar biometría'}
                </button>
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

      <Modal abierto={modalAbierto} titulo={empleadoEditando ? 'Editar personal' : 'Agregar personal'} onCerrar={() => setModalAbierto(false)}>
        <form onSubmit={guardar}>
          {errorModal && <p className="error alerta-modal">{errorModal}</p>}
          <div className="campo-fila">
            <label className="campo">
              Nombre
              <input placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
            </label>
            <label className="campo">
              Apellido
              <input placeholder="Apellido" value={nuevoApellido} onChange={(e) => setNuevoApellido(e.target.value)} required />
            </label>
          </div>
          <div className="campo-fila">
            <label className="campo">
              Documento (CI)
              <input placeholder="Documento (CI)" value={nuevoDocumentoNro} onChange={(e) => setNuevoDocumentoNro(e.target.value)} required />
            </label>
            <label className="campo">
              Teléfono
              <input type="tel" placeholder="Ej: 70012345" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} />
            </label>
          </div>
          <label className="campo">
            Área de trabajo
            <select value={nuevaArea} onChange={(e) => setNuevaArea(e.target.value)}>
              <option value="">Sin área asignada</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre} ({(a.bloques || []).map((b) => `${b.hora_inicio}–${b.hora_fin}`).join(' / ') || '—'})</option>
              ))}
            </select>
            <span className="ayuda">El atraso se calcula contra el horario del área. Las áreas se administran en "Áreas y horarios".</span>
          </label>
          <div className="campo-fila">
            <label className="campo">
              Fecha de ingreso
              <input type="date" value={nuevaFechaIngreso} onChange={(e) => setNuevaFechaIngreso(e.target.value)} />
              <span className="ayuda">Antigüedad para el futuro módulo de Vacaciones. Si no la sabés, se puede completar después.</span>
            </label>
            <label className="campo">
              Fecha de retiro
              <input type="date" value={nuevaFechaRetiro} onChange={(e) => setNuevaFechaRetiro(e.target.value)} />
              <span className="ayuda">Solo si el personal ya dejó de trabajar. Dejar vacío mientras esté activo.</span>
            </label>
          </div>
          <label className="campo campo-check">
            <span>
              <input type="checkbox" checked={nuevoEsSupervisor} onChange={(e) => setNuevoEsSupervisor(e.target.checked)} />
              {' '}Es supervisor de sucursales
            </span>
            <span className="ayuda">Los supervisores pueden registrar visitas a sucursales desde su celular.</span>
          </label>
          {empleadoEditando && (
            <label className="campo">
              Estado
              <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
          )}
          {!empleadoEditando && (
            <label className="campo">
              Foto para biometría (opcional)
              <div className="foto-biometria-campo">
                {fotoPreviewUrl && <img src={fotoPreviewUrl} alt="Vista previa" className="foto-biometria-preview" />}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={manejarNuevaFoto} />
              </div>
              <span className="ayuda">Cara de frente, buena luz. Si no la subís ahora, podés enrolarla después desde la fila.</span>
            </label>
          )}
          <button
            type="submit"
            className="boton-icono"
            title={empleadoEditando ? 'Guardar cambios' : 'Crear'}
            aria-label={empleadoEditando ? 'Guardar cambios' : 'Crear'}
            disabled={guardando}
          >
            {empleadoEditando ? <IconGuardar /> : <IconCrear />}
          </button>
          <button type="button" className="boton-icono" title="Cancelar" aria-label="Cancelar" onClick={() => setModalAbierto(false)} disabled={guardando}><IconCancelar /></button>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={dispositivoARevocar != null}
        titulo="Revocar dispositivo"
        mensaje={dispositivoARevocar && `¿Revocar el dispositivo de ${dispositivoARevocar.nombreCompleto}? Va a tener que volver a enrolarlo para poder marcar de nuevo.`}
        onConfirmar={confirmarRevocarDispositivo}
        onCancelar={() => setDispositivoARevocar(null)}
      />
    </div>
  );
}

export default Empleados;
