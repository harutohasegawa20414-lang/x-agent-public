import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.VITE_API_KEY || ''
  const proxyHeaders = apiKey ? { 'x-api-key': apiKey } : {}

  return {
    plugins: [react()],
    server: {
      port: 5001,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5002',
          changeOrigin: true,
          headers: proxyHeaders,
        },
        '/no9-api': {
          target: 'http://localhost:5003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/no9-api/, ''),
          headers: proxyHeaders,
        }
      }
    }
  }
})
