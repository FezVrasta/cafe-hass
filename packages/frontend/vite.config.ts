import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/cafe-hass/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        // Main app entry (loaded by iframe via index.html)
        main: path.resolve(__dirname, 'index.html'),
        // Panel wrapper entry (loaded by HA as module)
        'panel-wrapper': path.resolve(__dirname, 'src/panel-wrapper.ts'),
      },
      output: {
        // Ensure panel-wrapper has a predictable name for HA to load
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'panel-wrapper') {
            return 'assets/panel-wrapper.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  server: {
    port: 5174,
    open: true,
  },
});
