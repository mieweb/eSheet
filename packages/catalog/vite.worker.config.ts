import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  build: {
    outDir: 'dist',
    // tsc emits the compiler, runtime and declarations before this build.
    emptyOutDir: false,
    lib: {
      entry: 'src/catalog.worker.ts',
      formats: ['es'],
      // Public asset contract: hosts resolve @esheet/catalog/worker and may
      // hash/copy these bytes without bundling or importing field-health.
      fileName: () => 'catalog.worker.js',
    },
  },
});
