import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';

function Turnos() {
  const { request } = useAuth();
  const [turnos, setTurnos] = useState([]);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ horaInicio: '', horaFin: '' });
  const [margen, setMargen] = useState('');
  const [margenGuardado, setMargenGuardado] = useState(false);

  const { datosPaginados, paginaActiva, totalPaginas, irPaginaSiguiente, irPaginaAnterior } = usePaginacion(turnos, 10);

  async function cargar() {
    try {
      const [listaTurnos, configuracion] = await Promise.all([
        request('/turnos'),
        request('/configuracion'),
      ]);
      setTurnos(listaTurnos);
      setMargen(String(configuracion.margenAnticipacionMin));
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, no sincronización de UI
  useEffect(() => { cargar(); }, []);

  function abrirEdicion(turno) {
    setEditandoId(turno.id);
    setForm({ horaInicio: turno.hora_inicio, horaFin: turno.hora_fin });
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    try {
      await request(`/turnos/${editandoId}`, { method: 'PUT', body: form });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarMargen(e) {
    e.preventDefault();
    setError(null);
    setMargenGuardado(false);
    try {
      await request('/configuracion', { method: 'PUT', body: { margenAnticipacionMin: Number(margen) } });
      setMargenGuardado(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>Turnos</h1>
      <p className="subtitulo">
        Estos horarios aplican a todo el personal por igual: cada marcación de entrada se
        asigna sola al turno más cercano, no hay horario individual por persona.
      </p>
      {error && <p className="error">{error}</p>}

      <table className="tabla">
        <thead>
          <tr><th>Turno</th><th>Entrada</th><th>Salida</th><th></th></tr>
        </thead>
        <tbody>
          {datosPaginados.map((t) => (
            <tr key={t.id}>
              <td>{t.nombre}</td>
              <td>{t.hora_inicio}</td>
              <td>{t.hora_fin}</td>
              <td><button type="button" onClick={() => abrirEdicion(t)}>Editar horario</button></td>
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
        titulo={`Editar horario — ${turnos.find((t) => t.id === editandoId)?.nombre ?? ''}`}
        onCerrar={() => setEditandoId(null)}
      >
        <form onSubmit={guardar}>
          <label className="campo">
            Entrada
            <input
              type="time"
              value={form.horaInicio}
              onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
              required
            />
          </label>
          <label className="campo">
            Salida
            <input
              type="time"
              value={form.horaFin}
              onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
              required
            />
          </label>
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => setEditandoId(null)}>Cancelar</button>
        </form>
      </Modal>

      <div className="card">
        <h2>Margen para marcar entrada temprano</h2>
        <p className="subtitulo" style={{ marginTop: 0 }}>
          Si alguien marca entrada con más anticipación que este margen, no se le bloquea —
          la marcación queda guardada para que la revises en la cola de Marcaciones.
        </p>
        <form className="form-inline" onSubmit={guardarMargen}>
          <label className="campo">
            Minutos de margen
            <input
              type="number"
              min="0"
              max="240"
              value={margen}
              onChange={(e) => { setMargen(e.target.value); setMargenGuardado(false); }}
              required
            />
          </label>
          <button type="submit">Guardar margen</button>
          {margenGuardado && <span className="ayuda">Guardado.</span>}
        </form>
      </div>
    </div>
  );
}

export default Turnos;
