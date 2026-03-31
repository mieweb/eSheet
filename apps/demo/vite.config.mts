/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  // Keep local dev at / while producing /demo/ assets for canonical host routing.
  base: command === 'serve' ? '/' : '/demo/',
  ...(command === 'serve'
    ? {
        resolve: {
          conditions: ['@esheet/source'],
        },
      }
    : {}),
  server: {
    port: 3001,
    host: 'localhost',
  },
  preview: {
    port: 3001,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
}));
