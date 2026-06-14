import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    // @ts-ignore - Vite 运行时支持 historyApiFallback
    historyApiFallback: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
})
