import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // './' garante que o build use paths relativos,
  // necessário para funcionar tanto em file:// (Electron) quanto em /
  base: './',
  server: {
    port: 5173,
  },
})
