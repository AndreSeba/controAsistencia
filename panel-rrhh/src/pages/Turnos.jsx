import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/Paginacion';
import { IconGuardar, IconCrear, IconEditar, IconEliminar, IconCancelar, IconCamara } from '../components/Icons';
import { redimensionarFoto } from '../lib/redimensionarFoto';

const BLOQUE_VACIO = { horaInicio: '', horaFin: '' };
const DIAS_SEMANA = [
  { valor: 1, corta: 'L', nombre: 'Lunes' },
  { valor: 2, corta: 'M', nombre: 'Martes' },
  { valor: 3, corta: 'X', nombre: 'Miércoles' },
  { valor: 4, corta: 'J', nombre: 'Jueves' },
  { valor: 5, corta: 'V', nombre: 'Viernes' },
  { valor: 6, corta: 'S', nombre: 'Sábado' },
  { valor: 7, corta: 'D', nombre: 'Domingo' },
];
const TODOS_LOS_DIAS = DIAS_SEMANA.map((d) => d.valor);

function nuevoGrupoVacio() {
  return { dias: [1, 2, 3, 4, 5], bloques: [{ ...BLOQUE_VACIO }] };
}

function mismosDias(a, b) {
  return a.length === b.length && a.every((d) => b.includes(d));
}

// El backend no sabe nada de "grupos" — solo recibe un array plano de bloques, cada uno
// con sus propios horaInicio/horaFin/diasSemana (ver 027_bloque_dias_semana.sql). Agrupar
// por días es pura comodidad de esta pantalla, para no repetir la misma selección de días
// bloque por bloque (Administración: 2 bloques L-V con los mismos días + 1 el sábado).
// Reutilizada también para MOSTRAR el horario en la tabla, no solo para el form de edición.
function agruparBloques(bloquesApi) {
  if (!bloquesApi || bloquesApi.length === 0) return [nuevoGrupoVacio()];
  const grupos = [];
  for (const b of bloquesApi) {
    const dias = b.dias_semana ?? TODOS_LOS_DIAS;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && mismosDias(ultimo.dias, dias)) {
      ultimo.bloques.push({ horaInicio: b.hora_inicio, horaFin: b.hora_fin });
    } else {
      grupos.push({ dias: [...dias], bloques: [{ horaInicio: b.hora_inicio, horaFin: b.hora_fin }] });
    }
  }
  return grupos;
}

function aplanarGrupos(grupos) {
  return grupos.flatMap((g) => g.bloques.map((b) => ({ ...b, diasSemana: g.dias })));
}

// Ningún día puede estar en dos grupos a la vez — sería ambiguo contra qué horario medir
// el atraso ese día. Se valida acá (mensaje claro antes de mandar el request) además de
// en el backend (que rechaza el guardado igual si esto se saltea).
function diasRepetidosEntreGrupos(grupos) {
  const vistos = new Set();
  for (const g of grupos) {
    for (const d of g.dias) {
      if (vistos.has(d)) return true;
      vistos.add(d);
    }
  }
  return false;
}

function formatearDias(dias) {
  if (dias.length === 7) return null; // aplica todos los días: no agregar ruido visual
  const ordenados = [...dias].sort((a, b) => a - b);
  const corta = (d) => DIAS_SEMANA.find((x) => x.valor === d).corta;
  const consecutivos = ordenados.length > 1 && ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);
  return consecutivos ? `${corta(ordenados[0])}-${corta(ordenados.at(-1))}` : ordenados.map(corta).join('');
}

// Un grupo = un conjunto de días + su propio horario (1 bloque corrido, o 2 con corte al
// mediodía). Por defecto un área tiene un solo grupo con los 7 días — "Agregar horario
// para otros días" (en GruposHorarioInputs) suma otro grupo para el caso de Administración:
// lunes a viernes un horario, sábado otro, domingo ninguno (no se le tilda ningún día).
function GrupoInputs({ grupo, onChange, onQuitar, permitirQuitar }) {
  const discontinuo = grupo.bloques.length > 1;

  function actualizarBloque(i, campo, valor) {
    const bloques = grupo.bloques.map((b, idx) => (idx === i ? { ...b, [campo]: valor } : b));
    onChange({ ...grupo, bloques });
  }

  function alternarDiscontinuo(marcado) {
    const bloques = marcado
      ? [grupo.bloques[0] ?? { ...BLOQUE_VACIO }, { ...BLOQUE_VACIO }]
      : [grupo.bloques[0] ?? { ...BLOQUE_VACIO }];
    onChange({ ...grupo, bloques });
  }

  function alternarDia(valor) {
    const dias = grupo.dias.includes(valor)
      ? grupo.dias.filter((d) => d !== valor)
      : [...grupo.dias, valor].sort((a, b) => a - b);
    onChange({ ...grupo, dias });
  }

  function campoBloque(i, etiquetaEntrada, etiquetaSalida) {
    const b = grupo.bloques[i] ?? BLOQUE_VACIO;
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
    <div className="grupo-horario">
      <div className="dias-semana-selector">
        {DIAS_SEMANA.map((d) => (
          <label
            key={d.valor}
            className={`dia-toggle ${grupo.dias.includes(d.valor) ? 'activo' : ''}`}
            title={d.nombre}
          >
            <input type="checkbox" checked={grupo.dias.includes(d.valor)} onChange={() => alternarDia(d.valor)} />
            {d.corta}
          </label>
        ))}
      </div>

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

      {permitirQuitar && (
        <button
          type="button"
          className="boton-icono grupo-horario-quitar"
          title="Quitar este horario"
          aria-label="Quitar este horario"
          onClick={onQuitar}
        >
          <IconEliminar />
        </button>
      )}
    </div>
  );
}

// Un área tiene 1+ grupos de horario, cada uno para un conjunto de días distinto — por
// defecto un solo grupo con los 7 días (el caso de siempre: mismo horario todo el
// tiempo). "Agregar horario para otros días" es lo que habilita el caso de Administración
// (semana + sábado con horarios distintos, domingo sin ninguno).
function GruposHorarioInputs({ grupos, onChange }) {
  function actualizarGrupo(i, grupo) {
    onChange(grupos.map((g, idx) => (idx === i ? grupo : g)));
  }
  function agregarGrupo() {
    onChange([...grupos, nuevoGrupoVacio()]);
  }
  function quitarGrupo(i) {
    onChange(grupos.filter((_, idx) => idx !== i));
  }

  return (
    <div className="grupos-horario">
      {grupos.map((g, i) => (
        <GrupoInputs
          key={i}
          grupo={g}
          onChange={(g2) => actualizarGrupo(i, g2)}
          onQuitar={() => quitarGrupo(i)}
          permitirQuitar={grupos.length > 1}
        />
      ))}
      <button type="button" className="boton-agregar-grupo" onClick={agregarGrupo}>
        <IconCrear /> Agregar horario para otros días
      </button>
      <span className="ayuda">
        Por defecto el horario de arriba aplica todos los días. Agregá otro grupo si, por
        ejemplo, el sábado tiene un horario distinto — un día sin ningún grupo tildado
        queda sin turno ese día (no cuenta atraso, RRHH lo revisa si alguien marca igual).
      </span>
    </div>
  );
}

// Dos checkboxes atados a UN solo booleano (requiereSalida): marcar "Solo entrada"
// automáticamente desmarca "Entrada y salida" y viceversa, porque son la misma variable
// vista desde los dos lados — nunca pueden quedar los dos marcados ni los dos vacíos.
function RequiereSalidaToggle({ requiereSalida, onChange }) {
  return (
    <div className="campo">
      <label className="campo campo-toggle">
        <input type="checkbox" checked={!requiereSalida} onChange={() => onChange(false)} />
        Solo entrada
      </label>
      <label className="campo campo-toggle">
        <input type="checkbox" checked={requiereSalida} onChange={() => onChange(true)} />
        Entrada y salida
      </label>
    </div>
  );
}

// Muestra los días junto al horario solo cuando el grupo NO aplica todos los días — el
// caso común (un solo horario, todos los días) queda igual que antes, sin ruido nuevo.
function formatearBloques(bloques) {
  if (!bloques || bloques.length === 0) return '—';
  return agruparBloques(bloques)
    .map((g) => {
      const dias = formatearDias(g.dias);
      const horarios = g.bloques.map((b) => `${b.horaInicio}–${b.horaFin}`).join(' / ');
      return dias ? `${dias} ${horarios}` : horarios;
    })
    .join('   •   ');
}

function Turnos() {
  const { request } = useAuth();
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [formGrupos, setFormGrupos] = useState([nuevoGrupoVacio()]);
  const [formDescuento, setFormDescuento] = useState(true);
  const [formPagoDiario, setFormPagoDiario] = useState(true);
  const [formRequiereSalida, setFormRequiereSalida] = useState(true);
  const [modalNueva, setModalNueva] = useState(false);
  const [formNueva, setFormNueva] = useState({ nombre: '', grupos: [nuevoGrupoVacio()], aplicaDescuento: true, aplicaPagoDiario: true, requiereSalida: true });
  const [errorModal, setErrorModal] = useState(null);
  const [margen, setMargen] = useState('');
  const [pagoDia, setPagoDia] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const logoInputRef = useRef(null);
  const subiendoLogoRef = useRef(false);
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
      setLogoUrl(configuracion.logoUrl || null);
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
    setFormGrupos(agruparBloques(area.bloques));
    setFormDescuento(area.aplica_descuento !== false);
    setFormPagoDiario(area.aplica_pago_diario !== false);
    setFormRequiereSalida(area.requiere_salida !== false);
  }

  async function guardar(e) {
    e.preventDefault();
    if (guardandoRef.current) return;
    if (diasRepetidosEntreGrupos(formGrupos)) {
      setErrorModal('Un mismo día no puede estar en dos horarios distintos del área.');
      return;
    }
    guardandoRef.current = true;
    setErrorModal(null);
    setGuardando(true);
    try {
      await request(`/turnos/${editandoId}`, {
        method: 'PUT',
        body: { nombre: nombreEdit, bloques: aplanarGrupos(formGrupos), aplicaDescuento: formDescuento, aplicaPagoDiario: formPagoDiario, requiereSalida: formRequiereSalida },
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
    setFormNueva({ nombre: '', grupos: [nuevoGrupoVacio()], aplicaDescuento: true, aplicaPagoDiario: true, requiereSalida: true });
    setErrorModal(null);
    setModalNueva(true);
  }

  async function crearArea(e) {
    e.preventDefault();
    if (creandoRef.current) return;
    if (diasRepetidosEntreGrupos(formNueva.grupos)) {
      setErrorModal('Un mismo día no puede estar en dos horarios distintos del área.');
      return;
    }
    creandoRef.current = true;
    setErrorModal(null);
    setGuardando(true);
    try {
      await request('/turnos', {
        method: 'POST',
        body: {
          nombre: formNueva.nombre,
          bloques: aplanarGrupos(formNueva.grupos),
          aplicaDescuento: formNueva.aplicaDescuento,
          aplicaPagoDiario: formNueva.aplicaPagoDiario,
          requiereSalida: formNueva.requiereSalida,
        },
      });
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

  // Mismo criterio que la foto de biometría: se reduce en el navegador antes de subir.
  // Un logo que sale de Canva/Illustrator puede pesar varios MB y no aporta nada a 36px.
  async function manejarLogoSeleccionado(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo || subiendoLogoRef.current) return;
    subiendoLogoRef.current = true;
    setError(null);
    setSubiendoLogo(true);
    try {
      const reducido = await redimensionarFoto(archivo, 256);
      const formData = new FormData();
      formData.append('logo', reducido, 'logo.jpg');
      const { logoUrl: nuevo } = await request('/configuracion/logo', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      setLogoUrl(nuevo);
    } catch (err) {
      setError(err.message);
    } finally {
      subiendoLogoRef.current = false;
      setSubiendoLogo(false);
    }
  }

  async function quitarLogo() {
    setError(null);
    try {
      await request('/configuracion/logo', { method: 'DELETE' });
      setLogoUrl(null);
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
          <tr><th>Área</th><th>Horario</th><th>Marca</th><th>Descuento</th><th>Pago por día</th><th></th></tr>
        </thead>
        <tbody>
          {datosPaginados.map((t) => (
            <tr key={t.id}>
              <td>{t.nombre}</td>
              <td>{formatearBloques(t.bloques)}</td>
              <td>{t.requiere_salida !== false ? 'Entrada y salida' : 'Solo entrada'}</td>
              <td>
                <span className={`badge ${t.aplica_descuento ? 'badge-activo' : 'badge-inactivo'}`}>
                  {t.aplica_descuento ? 'Sí' : 'No'}
                </span>
              </td>
              <td>
                <span className={`badge ${t.aplica_pago_diario ? 'badge-activo' : 'badge-inactivo'}`}>
                  {t.aplica_pago_diario ? 'Sí' : 'No'}
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
          <GruposHorarioInputs grupos={formGrupos} onChange={setFormGrupos} />
          <label className="campo campo-toggle">
            <input
              type="checkbox"
              checked={formDescuento}
              onChange={(e) => setFormDescuento(e.target.checked)}
            />
            Aplica descuento por atraso
          </label>
          <label className="campo campo-toggle">
            <input
              type="checkbox"
              checked={formPagoDiario}
              onChange={(e) => setFormPagoDiario(e.target.checked)}
            />
            Aplica pago por día
          </label>
          <span className="ayuda">Desmarcá esto para áreas que no cobran por día trabajado (ej. Administración, sueldo aparte) — no van a aparecer en la Planilla quincenal.</span>
          <RequiereSalidaToggle requiereSalida={formRequiereSalida} onChange={setFormRequiereSalida} />
          <span className="ayuda">"Solo entrada" cierra la jornada apenas se marca — el personal de esta área no va a ver el botón de Salida en su celular.</span>
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
          <GruposHorarioInputs
            grupos={formNueva.grupos}
            onChange={(grupos) => setFormNueva({ ...formNueva, grupos })}
          />
          <label className="campo campo-toggle">
            <input
              type="checkbox"
              checked={formNueva.aplicaDescuento}
              onChange={(e) => setFormNueva({ ...formNueva, aplicaDescuento: e.target.checked })}
            />
            Aplica descuento por atraso
          </label>
          <label className="campo campo-toggle">
            <input
              type="checkbox"
              checked={formNueva.aplicaPagoDiario}
              onChange={(e) => setFormNueva({ ...formNueva, aplicaPagoDiario: e.target.checked })}
            />
            Aplica pago por día
          </label>
          <span className="ayuda">Desmarcá esto para áreas que no cobran por día trabajado (ej. Administración, sueldo aparte) — no van a aparecer en la Planilla quincenal.</span>
          <RequiereSalidaToggle
            requiereSalida={formNueva.requiereSalida}
            onChange={(v) => setFormNueva({ ...formNueva, requiereSalida: v })}
          />
          <span className="ayuda">"Solo entrada" cierra la jornada apenas se marca — el personal de esta área no va a ver el botón de Salida en su celular.</span>
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

      <div className="card">
        <h2>Identidad de la empresa</h2>
        <p className="subtitulo" style={{ marginTop: 0 }}>
          El logo se muestra en el panel y en la app del personal. Cuadrado o apaisado, se
          ajusta solo; si no cargás ninguno, queda solo el texto.
        </p>
        <div className="logo-config">
          {logoUrl
            ? <img src={logoUrl} alt="Logo de la empresa" className="logo-preview" />
            : <div className="logo-preview logo-preview--vacio">Sin logo</div>}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={manejarLogoSeleccionado}
          />
          <button
            type="button"
            className="boton-icono"
            title={subiendoLogo ? 'Subiendo…' : (logoUrl ? 'Cambiar logo' : 'Subir logo')}
            aria-label={logoUrl ? 'Cambiar logo' : 'Subir logo'}
            onClick={() => logoInputRef.current?.click()}
            disabled={subiendoLogo}
          >
            <IconCamara />
          </button>
          {logoUrl && (
            <button
              type="button"
              className="boton-icono"
              title="Quitar logo"
              aria-label="Quitar logo"
              onClick={quitarLogo}
              disabled={subiendoLogo}
            >
              <IconEliminar />
            </button>
          )}
        </div>
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
