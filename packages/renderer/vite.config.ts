/// <reference types='vitest' />
import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/renderer',
  plugins: [react(), dts({ tsconfigPath: './tsconfig.lib.json' })],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'EsheetRenderer',
      fileName: 'index',
      formats: ['es'] as LibraryFormats[],
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@esheet/core',
        '@esheet/styles',
        // Must stay external: the field component registry lives in
        // @esheet/fields, and registerCustomFieldTypes() only reaches the
        // renderer when host and renderer share one module instance.
        '@esheet/fields',
        'tslib',
      ],
    },
    cssCodeSplit: false,
    sourcemap: false,
    emptyOutDir: false,
  },
  test: {
    name: '@esheet/renderer',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
