import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Local development talks to the Compose API on :8081 through this proxy so
// every page can use same-origin paths ("/api/dashboard", "/eda/..."). On
// Vercel the same paths stay in the same origin, so no build-time switch.
const API = process.env.VITE_DEV_API || 'http://127.0.0.1:8080'

const proxy = Object.fromEntries(
  ['/api', '/eda', '/predict', '/recommendations', '/health', '/docs', '/openapi.json'].map((prefix) => [
    prefix,
    { target: API, changeOrigin: true },
  ]),
)

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173 },
})
