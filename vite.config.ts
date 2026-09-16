import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globIgnores: ['**/node_modules/**/*', '**/webllm-*.js', '**/pdfjs-*.js', '**/mammoth-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'SMRT',
        short_name: 'SMRT',
        description: 'Offline-first AI study companion',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) return 'webllm';
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('mammoth')) return 'mammoth';
        },
      },
    },
  },
})