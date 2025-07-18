import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  preview: {
    allowedHosts: [
      'quizmo-yvx1.onrender.com', // Your Render host
      'localhost',                // Keep localhost for development
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable source maps for production security
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
})
