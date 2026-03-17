/// <reference types='vitest' />
import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Inline-CSS plugin (production build only)
// ---------------------------------------------------------------------------
function inlineCssFields(): import('vite').Plugin {
  return {
    name: 'inline-css-fields',
    apply: 'build',
    generateBundle(_options, bundle) {
      const cssPath = resolve(import.meta.dirname, 'src/index.output.css');
      if (!fs.existsSync(cssPath)) return;
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];
        if (fileName.endsWith('.js') && chunk.type === 'chunk') {
          chunk.code =
            `(function(){` +
            `if(typeof document==='undefined')return;` +
            `if(window.__MSHEET_FIELDS_CSS_INJECTED)return;` +
            `if(!document.querySelector('#msheet-fields-styles')){` +
            `var s=document.createElement('style');` +
            `s.id='msheet-fields-styles';` +
            `s.textContent=${JSON.stringify(cssContent)};` +
            `document.head.appendChild(s);}` +
            `window.__MSHEET_FIELDS_CSS_INJECTED=true;` +
            `})();\n` +
            chunk.code;
        }
      }
    },
    writeBundle(outputOptions) {
      try {
        const outDir = resolve(
          import.meta.dirname,
          outputOptions?.dir || 'dist',
        );
        if (!fs.existsSync(outDir)) return;
        for (const f of fs.readdirSync(outDir)) {
          if (f.endsWith('.css')) {
            try {
              fs.unlinkSync(resolve(outDir, f));
            } catch {
              /* non-fatal */
            }
          }
        }
      } catch {
        /* non-fatal */
      }
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/fields',
  plugins: [react(), tailwindcss(), inlineCssFields()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'MsheetFields',
      fileName: 'index',
      formats: ['es'] as LibraryFormats[],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@msheet/core',
        'tslib',
      ],
    },
    cssCodeSplit: false,
    sourcemap: false,
  },
  test: {
    name: '@msheet/fields',
    watch: false,
    passWithNoTests: true,
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
