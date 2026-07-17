/// <reference types='vitest' />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Copies all .wasm files from @kerebron/wasm/assets (nested) into
 * public/kerebron-wasm/ (flat) so createAssetLoad('/kerebron-wasm') can fetch
 * them. Runs on every dev server start and production build.
 */
function kerebronWasmPlugin(): Plugin {
  const assetsDir = resolve(
    import.meta.dirname,
    '../../node_modules/@kerebron/wasm/assets'
  );
  const destDir = resolve(import.meta.dirname, 'public/kerebron-wasm');

  function syncWasm() {
    mkdirSync(destDir, { recursive: true });
    function walk(dir: string, relPath: string) {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, ent.name);
        const rel = relPath ? `${relPath}/${ent.name}` : ent.name;
        if (ent.isDirectory()) walk(full, rel);
        else if (ent.name.endsWith('.wasm')) {
          const dest = join(destDir, rel);
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(full, dest);
        }
      }
    }
    walk(assetsDir, '');
  }

  return { name: 'kerebron-wasm', buildStart: syncWasm };
}

export default defineConfig(({ command }) => ({
  root: import.meta.dirname,
  envDir: resolve(import.meta.dirname, '../..'),
  envPrefix: 'OZWELL_',
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
      '@esheet/pdf': resolve(
        import.meta.dirname,
        '../../packages/pdf/src/index.ts'
      ),
      '@esheet/field-kerebron': resolve(
        import.meta.dirname,
        '../../packages/field-kerebron/src/index.ts'
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
  plugins: [react(), tailwindcss(), kerebronWasmPlugin()],
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
