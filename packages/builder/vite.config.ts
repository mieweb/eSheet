/// <reference types='vitest' />
import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/builder',
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.lib.json', bundleTypes: true }),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'EsheetBuilder',
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
        // Must stay external for the same reason as the renderer: the field
        // component registry lives in @esheet/fields, and host-registered
        // custom field types only reach the builder when host and builder
        // share one module instance.
        '@esheet/fields',
        'zustand',
        'tslib',
      ],
    },
    cssCodeSplit: false,
    sourcemap: false,
    emptyOutDir: false,
  },
  test: {
    name: '@esheet/builder',
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
