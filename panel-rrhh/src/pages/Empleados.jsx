import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import { urlActivacion } from '../lib/urlPantalla';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';

function Empleados() {
  const { request } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApellido, setNuevoApellido] = useState('');
  const [nuevoDocumentoNro, setNuevoDocumentoNro] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('activo');
  const [tokenEmitido, setTokenEmitido] = useState(null);
  const [idCopiado, setIdCopiado] = useState(null);
  const fotoInputRef = useRef(null);
  const [empleadoBiometriaId, setEmpleadoBiometriaId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [empleadoEditando, setEmpleadoEditando] = useState(null);
  const [nuevaFoto, setNuevaFoto] = useState(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null); // errores del formulario, visibles DENTRO del modal

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
      setEmpleados(await request('/empleados?incluirInactivos=true'));
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
    setError(null);
    setErrorModal(null);
    setGuardando(true);
    try {
      if (empleadoEditando) {
        await request(`/empleados/${empleadoEditando.id}`, {
          method: 'PUT',
          body: { nombre: nuevoNombre, apellido: nuevoApellido, documentoNro: nuevoDocumentoNro, estado: nuevoEstado },
        });
      } else {
        const creado = await request('/empleados', {
          method: 'POST',
          body: { nombre: nuevoNombre, apellido: nuevoApellido, documentoNro: nuevoDocumentoNro, estado: nuevoEstado },
        });
        if (nuevaFoto) {
          try {
            const formData = new FormData();
            formData.append('foto', nuevaFoto);
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
      setGuardando(false);
    }
  }

  async function enrolarDispositivo(empleadoId) {
    setError(null);
    setTokenEmitido(null);
    try {
      const resultado = await request(`/empleados/${empleadoId}/dispositivo`, { method: 'POST' });
      setTokenEmitido({ empleadoId, token: resultado.deviceToken });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function copiarEnlace(empleadoId) {
    setError(null);
    try {
      const { deviceToken } = await request(`/empleados/${empleadoId}/dispositivo/enlace`);
      await navigator.clipboard.writeText(urlActivacion(deviceToken));
      setIdCopiado(empleadoId);
      setTimeout(() => setIdCopiado(null), 2000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function revocarDispositivo(empleadoId, dispositivoId) {
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
      const formData = new FormData();
      formData.append('foto', archivo);
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
      {tokenEmitido && (
        <p className="aviso">
          Device token para el personal #{tokenEmitido.empleadoId} (transmitir por canal seguro, no se
          volverá a mostrar): <code>{tokenEmitido.token}</code>
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '16px' }}>
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
        <button type="button" className="boton-nuevo" onClick={abrirCrear}>+ Agregar personal</button>
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
            <th>Nombre</th><th>Apellido</th><th>Documento</th><th>Estado</th><th>Acciones</th><th>Dispositivo</th><th>Biometría</th>
          </tr>
        </thead>
        <tbody>
          {datosPaginados.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nombre}</td>
              <td>{emp.apellido}</td>
              <td>{emp.documento_nro}</td>
              <td>{emp.estado}</td>
              <td>
                <button type="button" onClick={() => abrirEditar(emp)}>Editar</button>
              </td>
              <td>{emp.dispositivo_id ? 'Activo' : 'Sin enrolar'}</td>
              <td>{emp.biometria_id ? 'Activa' : 'Sin enrolar'}</td>
              <td>
                {emp.dispositivo_id ? (
                  <>
                    <button type="button" onClick={() => copiarEnlace(emp.id)}>Copiar enlace</button>
                    {idCopiado === emp.id && <span className="enlace-copiado">Copiado ✓</span>}
                    <button type="button" onClick={() => revocarDispositivo(emp.id, emp.dispositivo_id)}>Revocar dispositivo</button>
                  </>
                ) : (
                  <button type="button" onClick={() => enrolarDispositivo(emp.id)}>Enrolar dispositivo</button>
                )}
                <button type="button" onClick={() => abrirSelectorFoto(emp.id)}>
                  {emp.biometria_id ? 'Re-enrolar biometría' : 'Enrolar biometría'}
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
          {errorModal && <p className="error alerta-modal">⚠ {errorModal}</p>}
          <label className="campo">
            Nombre
            <input placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
          </label>
          <label className="campo">
            Apellido
            <input placeholder="Apellido" value={nuevoApellido} onChange={(e) => setNuevoApellido(e.target.value)} required />
          </label>
          <label className="campo">
            Documento (CI)
            <input placeholder="Documento (CI)" value={nuevoDocumentoNro} onChange={(e) => setNuevoDocumentoNro(e.target.value)} required />
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
          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : (empleadoEditando ? 'Guardar Cambios' : 'Crear')}
          </button>
          <button type="button" onClick={() => setModalAbierto(false)} disabled={guardando}>Cancelar</button>
        </form>
      </Modal>
    </div>
  );
}

export default Empleados;
