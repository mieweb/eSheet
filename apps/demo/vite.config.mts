/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  root: import.meta.dirname,
  envDir: resolve(import.meta.dirname, '../..'),
  cacheDir: '../../node_modules/.vite/apps/demo',
  // Keep local dev at / while producing /demo/ assets for canonical host routing.
  base: command === 'serve' ? '/' : '/demo/',
  // Resolve workspace packages to their TypeScript source for dev and build.
  // Explicit aliases are needed because Vite's commonjs resolver doesn't respect
  // custom export conditions (@esheet/source) during production builds.
  resolve: {
    alias: {
      '@esheet/adapters': resolve(
        import.meta.dirname,
        '../../packages/adapters/src/index.ts'
      ),
      '@esheet/core': resolve(
        import.meta.dirname,
        '../../packages/core/src/index.ts'
      ),
      '@esheet/fields': resolve(
        import.meta.dirname,
        '../../packages/fields/src/index.ts'
      ),
      '@esheet/builder': resolve(
        import.meta.dirname,
        '../../packages/builder/src/index.ts'
      ),
      '@esheet/renderer': resolve(
        import.meta.dirname,
        '../../packages/renderer/src/index.ts'
      ),
    },
  },
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
  },
  define: {
    'import.meta.vitest': undefined,
  },
}));
