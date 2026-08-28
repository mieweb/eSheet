/// <reference types='vitest' />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'module';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'fs';
import { join, resolve } from 'path';

const require = createRequire(import.meta.url);
const prosemirrorModelPath = require.resolve('prosemirror-model', {
  paths: [
    realpathSync(
      resolve(
        import.meta.dirname,
        '../../packages/field-kerebron/node_modules/@kerebron/editor'
      )
    ),
  ],
});

function kerebronWasmPlugin(command: 'build' | 'serve'): Plugin {
  const assetsDir = resolve(
    import.meta.dirname,
    'node_modules/@kerebron/wasm/assets'
  );

  function visitWasm(
    dir: string,
    relativePath: string,
    visit: (path: string, relativePath: string) => void
  ) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const nextRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;
      if (entry.isDirectory()) {
        visitWasm(path, nextRelativePath, visit);
      } else if (entry.name.endsWith('.wasm')) {
        visit(path, nextRelativePath);
      }
    }
  }

  return {
    name: 'kerebron-wasm',
    configureServer(server) {
      server.middlewares.use('/kerebron-wasm', (request, response, next) => {
        const relativePath = decodeURIComponent(
          request.url?.split('?')[0] ?? ''
        ).replace(/^\/+/, '');
        const assetPath = resolve(assetsDir, relativePath);
        if (relativePath.includes('..') || !existsSync(assetPath)) {
          next();
          return;
        }
        response.setHeader('Content-Type', 'application/wasm');
        response.end(readFileSync(assetPath));
      });
    },
    ...(command === 'build'
      ? {
          buildStart() {
            visitWasm(assetsDir, '', (path, relativePath) => {
              this.emitFile({
                type: 'asset',
                fileName: `kerebron-wasm/${relativePath}`,
                source: readFileSync(path),
              });
            });
          },
        }
      : {}),
  };
}

function codifyAssetsPlugin(
  assetsDir: string | undefined,
  command: 'build' | 'serve'
): Plugin {
  return {
    name: 'codify-assets',
    configureServer(server) {
      if (!assetsDir || !existsSync(assetsDir)) return;
      server.middlewares.use('/codify', (request, response, next) => {
        const relativePath = decodeURIComponent(
          request.url?.split('?')[0] ?? ''
        ).replace(/^\/+/, '');
        const assetPath = resolve(assetsDir, relativePath);
        if (relativePath.includes('..') || !existsSync(assetPath)) {
          next();
          return;
        }
        response.end(readFileSync(assetPath));
      });
    },
    buildStart() {
      if (command !== 'build' || !assetsDir || !existsSync(assetsDir)) return;
      const visit = (dir: string, relativePath: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          const nextRelativePath = relativePath
            ? `${relativePath}/${entry.name}`
            : entry.name;
          if (entry.isDirectory()) {
            visit(path, nextRelativePath);
          } else {
            this.emitFile({
              type: 'asset',
              fileName: `codify/${nextRelativePath}`,
              source: readFileSync(path),
            });
          }
        }
      };
      visit(assetsDir, '');
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const envDir = resolve(import.meta.dirname, '../..');
  const env = loadEnv(mode, envDir, '');

  return {
    root: import.meta.dirname,
    envDir,
    envPrefix: 'OZWELL_',
    cacheDir: '../../node_modules/.vite/apps/demo',
    // Keep local dev at / while producing /demo/ assets for canonical host routing.
    base: command === 'serve' ? '/' : '/demo/',
    // Resolve workspace packages to their TypeScript source for dev and build.
    // Explicit aliases are needed because Vite's commonjs resolver doesn't respect
    // custom export conditions (@esheet/source) during production builds.
    resolve: {
      dedupe: ['prosemirror-model'],
      alias: [
        {
          find: 'prosemirror-model',
          replacement: prosemirrorModelPath,
        },
        {
          find: '@esheet/adapters',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/adapters/src/index.ts'
          ),
        },
        {
          find: '@esheet/core',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/core/src/index.ts'
          ),
        },
        {
          find: '@esheet/fields',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/fields/src/index.ts'
          ),
        },
        {
          find: '@esheet/builder',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/builder/src/index.ts'
          ),
        },
        {
          find: '@esheet/renderer',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/renderer/src/index.ts'
          ),
        },
        {
          find: '@esheet/field-kerebron',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/field-kerebron/src/index.ts'
          ),
        },
        {
          find: '@esheet/field-health',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/field-health/src/index.ts'
          ),
        },
        {
          find: '@esheet/fields-documents',
          replacement: resolve(
            import.meta.dirname,
            '../../packages/fields-documents/src/index.ts'
          ),
        },
        {
          find: /^@mieweb\/ui$/,
          replacement: resolve(
            import.meta.dirname,
            '../../node_modules/@mieweb/ui'
          ),
        },
        {
          find: 'mermaid',
          replacement: resolve(import.meta.dirname, 'node_modules/mermaid'),
        },
        {
          find: 'papaparse',
          replacement: resolve(import.meta.dirname, 'node_modules/papaparse'),
        },
      ],
    },
    optimizeDeps: {
      entries: ['index.html', '../../packages/field-health/src/index.ts'],
    },
    server: {
      port: 3001,
      host: 'localhost',
    },
    preview: {
      port: 3001,
      host: 'localhost',
    },
    plugins: [
      react(),
      tailwindcss(),
      kerebronWasmPlugin(command),
      codifyAssetsPlugin(
        process.env.CODIFY_ASSETS_DIR ?? env.CODIFY_ASSETS_DIR,
        command
      ),
    ],
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
  };
});
