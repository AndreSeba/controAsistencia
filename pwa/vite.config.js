import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const certPath = path.join(dirname, '.cert', 'cert.pem')
const keyPath = path.join(dirname, '.cert', 'key.pem')

// getUserMedia exige contexto seguro: localhost cuenta, pero la IP de LAN del
// teléfono no. Si existe un certificado autofirmado en .cert/ (generado con
// openssl, ver README de la carpeta), se sirve por HTTPS para poder probar la
// cámara desde un teléfono físico en la misma red.
const httpsConfig = fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
  : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Control de Asistencia',
        short_name: 'Asistencia',
        description: 'Marcación de entrada y salida para empleados',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f12',
        theme_color: '#aa3bff',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Marcación necesita red real (cámara + servidor): no cachear /api,
        // solo precachear el shell de la app para que abra instalada sin conexión.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    host: true, // escuchar en la red local, no solo localhost (probar desde el teléfono)
    port: 5175,
    https: httpsConfig,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
