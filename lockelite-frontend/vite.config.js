import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Payment-service routes go to port 8081
      '/api/payments': { target: 'http://localhost:8081', changeOrigin: true },
      // Everything else goes to the main monolith on port 8080
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8080', changeOrigin: true }
    }
  }
})
