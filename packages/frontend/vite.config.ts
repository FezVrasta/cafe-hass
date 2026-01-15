import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin({
      dev: {
        enableDev: true,
      },
      topExecutionPriority: true,
      jsAssetsFilterFunction: function customJsAssetsfilterFunction(outputChunk) {
        return outputChunk.isEntry;
      },
      injectCode: (cssCode: string, _options) => {
        return `try{
          if(typeof window != 'undefined'){
            window.__CAFE_CSS__ = ${cssCode};
          }
        }catch(e){
          console.error('[C.A.F.E.] CSS setup failed:', e);
        }`;
      },
    }),
  ],
  base: '/cafe-hass/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
