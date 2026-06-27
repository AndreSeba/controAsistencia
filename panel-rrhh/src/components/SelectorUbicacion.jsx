import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconPng from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xPng from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';

// Vite no resuelve los íconos default de Leaflet por su ruta relativa: hay que
// apuntarlos a mano al asset procesado por el bundler.
const icono = L.icon({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIcon2xPng,
  shadowUrl: markerShadowPng,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const CENTRO_POR_DEFECTO = [-17.7833, -63.1821]; // Santa Cruz de la Sierra

function ClicEnMapa({ onSeleccionar }) {
  useMapEvents({
    click(e) {
      onSeleccionar(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecentrarMapa({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function SelectorUbicacion({ lat, lng, radioM, onCambiar }) {
  const posicion = lat != null && lng != null ? [Number(lat), Number(lng)] : null;

  function manejarSeleccion(nuevaLat, nuevaLng) {
    onCambiar(nuevaLat, nuevaLng);
  }

  return (
    <div className="mapa-wrapper">
      <MapContainer
        center={posicion || CENTRO_POR_DEFECTO}
        zoom={posicion ? 16 : 13}
        style={{ height: 320, width: '100%', borderRadius: 8 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClicEnMapa onSeleccionar={manejarSeleccion} />
        {posicion && <RecentrarMapa lat={posicion[0]} lng={posicion[1]} />}
        {posicion && (
          <Marker
            position={posicion}
            icon={icono}
            draggable
            eventHandlers={{
              dragend(e) {
                const { lat: nuevaLat, lng: nuevaLng } = e.target.getLatLng();
                manejarSeleccion(nuevaLat, nuevaLng);
              },
            }}
          />
        )}
        {posicion && radioM > 0 && (
          <Circle center={posicion} radius={Number(radioM)} pathOptions={{ color: '#6d28d9' }} />
        )}
      </MapContainer>
      <p className="ayuda-mapa">
        {posicion
          ? 'Arrastrá el marcador para ajustar el punto exacto.'
          : 'Hacé clic en el mapa para marcar la ubicación de la sucursal.'}
      </p>
    </div>
  );
}

export default SelectorUbicacion;
