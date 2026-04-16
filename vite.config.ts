/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  build: {
    // Split big third-party packages into their own chunks so the
    // initial bundle is small. Agora alone is ~1.5MB and only needed
    // when the user starts a call; emoji-picker is ~400KB and only
    // needed when the user opens the emoji panel; leaflet is ~200KB
    // and only used in LocationPicker.
    rollupOptions: {
      output: {
        manualChunks: {
          'agora': ['agora-rtc-sdk-ng'],
          'emoji': ['emoji-picker-react'],
          'leaflet': ['leaflet'],
          'supabase': ['@supabase/supabase-js'],
          'vendor': ['react', 'react-dom', 'react-router', 'react-router-dom', '@ionic/react', '@ionic/react-router', 'ionicons'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
