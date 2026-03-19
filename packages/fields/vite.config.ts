/// <reference types='vitest' />
import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';

// ---------------------------------------------------------------------------
// Inline-CSS plugin (production build only)
// ---------------------------------------------------------------------------
function inlineCssFields(): import('vite').Plugin {
  return {
    name: 'inline-css-fields',
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
        `if(window.__MSHEET_FIELDS_CSS_INJECTED)return;` +
        `if(!document.querySelector('#msheet-fields-styles')){` +
        `var s=document.createElement('style');` +
        `s.id='msheet-fields-styles';` +
        `s.textContent=${JSON.stringify(cssContent)};` +
        `document.head.appendChild(s);}` +
        `window.__MSHEET_FIELDS_CSS_INJECTED=true;` +
        `})();\n`;
      writeFileSync(jsPath, iife + jsContent);
      unlinkSync(cssPath);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/fields',
  plugins: [react(), inlineCssFields()],
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
