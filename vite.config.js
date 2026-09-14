import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Nimiq Pay mini-app: host:true so phone on same Wi-Fi can load http://<ip>:5173
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
