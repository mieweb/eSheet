/// <reference types="vitest" />
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type LibraryFormats } from 'vite';
import dts from 'vite-plugin-dts';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => ({
  root: projectRoot,
  cacheDir: '../../node_modules/.vite/packages/pdf',
  plugins: [dts({ tsconfigPath: './tsconfig.lib.json' })],
  build: {
    lib: {
      entry: resolve(projectRoot, 'src/index.ts'),
      name: 'EsheetPdf',
      fileName: 'index',
      formats: ['es'] as LibraryFormats[],
    },
    rollupOptions: {
      external: ['@esheet/core', 'pdf-lib', 'tslib'],
    },
    sourcemap: false,
    emptyOutDir: false,
  },
  test: {
    name: '@esheet/pdf',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
