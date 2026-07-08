import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import SelectorUbicacion from '../components/SelectorUbicacion';
import Modal from '../components/Modal';
import { urlPantalla } from '../lib/urlPantalla';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import { IconGuardar, IconCrear, IconCancelar, IconCopiar, IconEditar, IconEliminar } from '../components/Icons';

const GEOCERCA_VACIA = { geoLat: null, geoLng: null, geoRadioM: 100 };

function Sucursales() {
  const { request } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(null); // 'crear' | 'editar' | null
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [nuevaGeocerca, setNuevaGeocerca] = useState(GEOCERCA_VACIA);
  const [editandoId, setEditandoId] = useState(null);
  const [geocercaEdit, setGeocercaEdit] = useState(GEOCERCA_VACIA);
  const [idCopiado, setIdCopiado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // Ref además del state: disabled del DOM se actualiza recién en el próximo
  // render, y 2 clicks muy rápidos pueden ocurrir antes de ese render.
  const crearRef = useRef(false);
  const geocercaRef = useRef(false);

  const { datosPaginados, paginaActiva, totalPaginas, irPaginaSiguiente, irPaginaAnterior } = usePaginacion(sucursales, 10);

  async function cargar() {
    try {
      setSucursales(await request('/sucursales?incluirInactivas=true'));
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setNuevaNombre('');
    setNuevaGeocerca(GEOCERCA_VACIA);
    setModalAbierto('crear');
  }

  async function crear(e) {
    e.preventDefault();
    if (crearRef.current) return;
    setError(null);
    if (nuevaGeocerca.geoLat == null) {
      setError('Marcá la ubicación de la sucursal en el mapa');
      return;
    }
    crearRef.current = true;
    setGuardando(true);
    try {
      await request('/sucursales', {
        method: 'POST',
        body: {
          nombre: nuevaNombre,
          geoLat: nuevaGeocerca.geoLat,
          geoLng: nuevaGeocerca.geoLng,
          geoRadioM: Number(nuevaGeocerca.geoRadioM),
        },
      });
      setModalAbierto(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      crearRef.current = false;
      setGuardando(false);
    }
  }

  async function alternarActivo(sucursal) {
    setError(null);
    try {
      await request(`/sucursales/${sucursal.id}`, {
        method: 'PUT',
        body: { nombre: sucursal.nombre, activo: !sucursal.activo },
      });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirEdicionGeocerca(sucursal) {
    setEditandoId(sucursal.id);
    setGeocercaEdit({
      geoLat: Number(sucursal.geo_lat),
      geoLng: Number(sucursal.geo_lng),
      geoRadioM: sucursal.geo_radio_m,
    });
    setModalAbierto('editar');
  }

  async function guardarGeocerca(e) {
    e.preventDefault();
    if (geocercaRef.current) return;
    geocercaRef.current = true;
    setError(null);
    setGuardando(true);
    try {
      await request(`/sucursales/${editandoId}/geocerca`, {
        method: 'PUT',
        body: {
          geoLat: geocercaEdit.geoLat,
          geoLng: geocercaEdit.geoLng,
          geoRadioM: Number(geocercaEdit.geoRadioM),
        },
      });
      setModalAbierto(null);
      setEditandoId(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      geocercaRef.current = false;
      setGuardando(false);
    }
  }

  async function copiarEnlace(sucursal) {
    try {
      await navigator.clipboard.writeText(urlPantalla(sucursal.id, sucursal.pantalla_token));
      setIdCopiado(sucursal.id);
      setTimeout(() => setIdCopiado(null), 2000);
    } catch {
      setError('No se pudo copiar el enlace');
    }
  }

  return (
    <div className="page">
      <h1>Sucursales</h1>
      <p className="subtitulo">Marcá en el mapa dónde está cada sucursal y qué tan amplia es la zona donde se permite marcar asistencia.</p>
      {error && <p className="error">{error}</p>}

      <button type="button" className="boton-nuevo" onClick={abrirCrear}><IconCrear /> Nueva sucursal</button>

      <table className="tabla">
        <thead>
          <tr>
            <th>Nombre</th><th>Distancia permitida</th><th>Estado</th><th>Enlace de pantalla (QR)</th><th></th>
          </tr>
        </thead>
        <tbody>
          {datosPaginados.map((s) => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td>{s.geo_radio_m} m</td>
              <td>{s.activo ? 'Activa' : 'Inactiva'}</td>
              <td>
                <span className="enlace-copiable">
                  <button type="button" onClick={() => copiarEnlace(s)}><IconCopiar /> Copiar enlace</button>
                  {idCopiado === s.id && <span className="enlace-copiado">Copiado ✓</span>}
                </span>
              </td>
              <td>
                <button type="button" onClick={() => abrirEdicionGeocerca(s)}><IconEditar /> Mover ubicación</button>
                <button type="button" onClick={() => alternarActivo(s)}>
                  {s.activo ? <IconEliminar /> : <IconGuardar />} {s.activo ? 'Desactivar' : 'Activar'}
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

      <Modal abierto={modalAbierto === 'crear'} titulo="Nueva sucursal" onCerrar={() => setModalAbierto(null)}>
        <form onSubmit={crear}>
          <label className="campo">
            Nombre de la sucursal
            <input placeholder="Ej: Sucursal Centro" value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)} required />
          </label>

          <SelectorUbicacion
            lat={nuevaGeocerca.geoLat}
            lng={nuevaGeocerca.geoLng}
            radioM={nuevaGeocerca.geoRadioM}
            onCambiar={(lat, lng) => setNuevaGeocerca((g) => ({ ...g, geoLat: lat, geoLng: lng }))}
          />

          <label className="campo campo-rango">
            Distancia permitida para marcar asistencia: <strong>{nuevaGeocerca.geoRadioM} metros</strong>
            <input
              type="range"
              min={20}
              max={500}
              step={10}
              value={nuevaGeocerca.geoRadioM}
              onChange={(e) => setNuevaGeocerca((g) => ({ ...g, geoRadioM: Number(e.target.value) }))}
            />
          </label>

          <button type="submit" disabled={guardando}><IconGuardar /> {guardando ? 'Guardando…' : 'Guardar sucursal'}</button>
        </form>
      </Modal>

      <Modal
        abierto={modalAbierto === 'editar'}
        titulo={`Editar ubicación — ${sucursales.find((s) => s.id === editandoId)?.nombre ?? ''}`}
        onCerrar={() => setModalAbierto(null)}
      >
        <form onSubmit={guardarGeocerca}>
          <SelectorUbicacion
            lat={geocercaEdit.geoLat}
            lng={geocercaEdit.geoLng}
            radioM={geocercaEdit.geoRadioM}
            onCambiar={(lat, lng) => setGeocercaEdit((g) => ({ ...g, geoLat: lat, geoLng: lng }))}
          />
          <label className="campo campo-rango">
            Distancia permitida para marcar asistencia: <strong>{geocercaEdit.geoRadioM} metros</strong>
            <input
              type="range"
              min={20}
              max={500}
              step={10}
              value={geocercaEdit.geoRadioM}
              onChange={(e) => setGeocercaEdit((g) => ({ ...g, geoRadioM: Number(e.target.value) }))}
            />
          </label>
          <button type="submit" disabled={guardando}><IconGuardar /> {guardando ? 'Guardando…' : 'Guardar cambios'}</button>
          <button type="button" onClick={() => setModalAbierto(null)}><IconCancelar /> Cancelar</button>
        </form>
      </Modal>
    </div>
  );
}

export default Sucursales;
