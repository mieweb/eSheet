import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';

// ---------------------------------------------------------------------------
// Inline-CSS plugin (production build only) — same pattern as @esheet/fields.
// Prepends a style-injection IIFE to dist/index.js so consumers don't need a
// separate CSS import for the Kerebron editor styles.
// ---------------------------------------------------------------------------
function inlineCssFieldKerebron(): import('vite').Plugin {
  return {
    name: 'inline-css-field-kerebron',
    apply: 'build',
    closeBundle() {
      const dir = resolve(import.meta.dirname, 'dist');
      const cssPath = resolve(dir, 'index.css');
      const jsPath = resolve(dir, 'index.js');
      if (!existsSync(cssPath) || !existsSync(jsPath)) return;
      const cssContent = readFileSync(cssPath, 'utf-8');
      const jsContent = readFileSync(jsPath, 'utf-8');
      const iife =
        `(function(){` +
        `if(typeof document==='undefined')return;` +
        `if(window.__ESHEET_FIELD_KEREBRON_CSS_INJECTED)return;` +
        `if(!document.querySelector('#esheet-field-kerebron-styles')){` +
        `var s=document.createElement('style');` +
        `s.id='esheet-field-kerebron-styles';` +
        `s.textContent=${JSON.stringify(cssContent)};` +
        `document.head.appendChild(s);}` +
        `window.__ESHEET_FIELD_KEREBRON_CSS_INJECTED=true;` +
        `})();\n`;
      writeFileSync(jsPath, iife + jsContent);
      unlinkSync(cssPath);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/field-kerebron',
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.lib.json', rollupTypes: true }),
    inlineCssFieldKerebron(),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'EsheetFieldKerebron',
      fileName: 'index',
      formats: ['es'] as LibraryFormats[],
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        '@esheet/core',
        'tslib',
        // Kerebron packages are bundled in (they are the point of this package)
      ],
    },
    cssCodeSplit: false,
    sourcemap: false,
  },
}));
