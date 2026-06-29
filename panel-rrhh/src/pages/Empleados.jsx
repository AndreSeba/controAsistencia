import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import { urlActivacion } from '../lib/urlPantalla';

function Empleados() {
  const { request } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApellido, setNuevoApellido] = useState('');
  const [nuevoDocumentoNro, setNuevoDocumentoNro] = useState('');
  const [tokenEmitido, setTokenEmitido] = useState(null);
  const [idCopiado, setIdCopiado] = useState(null);
  const fotoInputRef = useRef(null);
  const [empleadoBiometriaId, setEmpleadoBiometriaId] = useState(null);

  async function cargar() {
    try {
      setEmpleados(await request('/empleados?incluirInactivos=true'));
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setNuevoNombre('');
    setNuevoApellido('');
    setNuevoDocumentoNro('');
    setModalAbierto(true);
  }

  async function crear(e) {
    e.preventDefault();
    setError(null);
    try {
      await request('/empleados', {
        method: 'POST',
        body: { nombre: nuevoNombre, apellido: nuevoApellido, documentoNro: nuevoDocumentoNro },
      });
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message);
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
          Device token para el empleado #{tokenEmitido.empleadoId} (transmitir por canal seguro, no se
          volverá a mostrar): <code>{tokenEmitido.token}</code>
        </p>
      )}

      <button type="button" className="boton-nuevo" onClick={abrirCrear}>+ Agregar personal</button>

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
            <th>Nombre</th><th>Apellido</th><th>Documento</th><th>Estado</th><th>Dispositivo</th><th>Biometría</th><th></th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nombre}</td>
              <td>{emp.apellido}</td>
              <td>{emp.documento_nro}</td>
              <td>{emp.estado}</td>
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

      <Modal abierto={modalAbierto} titulo="Agregar personal" onCerrar={() => setModalAbierto(false)}>
        <form onSubmit={crear}>
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
          <button type="submit">Crear</button>
          <button type="button" onClick={() => setModalAbierto(false)}>Cancelar</button>
        </form>
      </Modal>
    </div>
  );
}

export default Empleados;
