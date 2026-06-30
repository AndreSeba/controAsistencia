import localforage from 'localforage';
import { request } from './api';

const store = localforage.createInstance({
  name: 'ControlAsistencia',
  storeName: 'marcaciones_offline'
});

export async function guardarMarcacionOffline(datos) {
  const id = Date.now().toString();
  await store.setItem(id, {
    ...datos,
    timestampOffline: id
  });
}

export async function obtenerMarcacionesPendientes() {
  const pendientes = [];
  await store.iterate((value, key) => {
    pendientes.push({ id: key, ...value });
  });
  return pendientes;
}

export async function sincronizarPendientes(deviceToken) {
  const pendientes = await obtenerMarcacionesPendientes();
  if (pendientes.length === 0) return 0;
  
  let sincronizadas = 0;
  
  for (const marcacion of pendientes) {
    try {
      const formData = new FormData();
      formData.append('selfie', marcacion.selfieBlob, 'selfie.jpg');
      formData.append('sucursalId', marcacion.sucursalId);
      formData.append('qrToken', marcacion.qrToken);
      formData.append('livenessNonce', marcacion.livenessNonce);
      formData.append('tipo', marcacion.tipo);
      formData.append('offlineMode', 'true');
      formData.append('timestampOffline', marcacion.timestampOffline);
      
      if (marcacion.gpsLat != null) {
        formData.append('gpsLat', marcacion.gpsLat);
        formData.append('gpsLng', marcacion.gpsLng);
        formData.append('gpsPrecisionM', marcacion.gpsPrecisionM);
      }
      
      await request('/marcaciones', {
        method: 'POST',
        deviceToken,
        body: formData,
        isFormData: true,
      });
      
      // Si fue exitoso, la borramos
      await store.removeItem(marcacion.id);
      sincronizadas++;
    } catch (err) {
      console.error('Error sincronizando marcación diferida', err);
      // No la borramos para reintentar más tarde
    }
  }
  
  return sincronizadas;
}
