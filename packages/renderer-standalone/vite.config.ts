/// <reference types='vitest' />
import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';

function inlineCssStandalone(): import('vite').Plugin {
  return {
    name: 'inline-css-renderer-standalone',
    apply: 'build',
    closeBundle() {
      const dir = resolve(import.meta.dirname, 'dist');
      const cssPath = resolve(dir, 'standalone.css');
      const jsPath = resolve(dir, 'standalone.js');
      if (!existsSync(cssPath) || !existsSync(jsPath)) return;
      const cssContent = readFileSync(cssPath, 'utf-8');
      const jsContent = readFileSync(jsPath, 'utf-8');
      const iife =
        `(function(){` +
        `if(typeof document==='undefined')return;` +
        `if(window.__ESHEET_RENDERER_STANDALONE_CSS_INJECTED)return;` +
        `if(!document.querySelector('#esheet-renderer-standalone-styles')){` +
        `var s=document.createElement('style');` +
        `s.id='esheet-renderer-standalone-styles';` +
        `s.textContent=${JSON.stringify(cssContent)};` +
        `document.head.appendChild(s);}` +
        `window.__ESHEET_RENDERER_STANDALONE_CSS_INJECTED=true;` +
        `})();\n`;
      writeFileSync(jsPath, iife + jsContent);
      unlinkSync(cssPath);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/renderer-standalone',
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.lib.json', rollupTypes: true }),
    inlineCssStandalone(),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.tsx'),
      name: 'EsheetRendererStandalone',
      fileName: 'standalone',
      formats: ['es'] as LibraryFormats[],
    },
    rollupOptions: {
      external: [],
    },
    cssCodeSplit: false,
    sourcemap: false,
  },
}));
