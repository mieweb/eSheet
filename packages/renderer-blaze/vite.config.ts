/// <reference types='vitest' />
import { defineConfig, type LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';

function inlineCssBlaze(): import('vite').Plugin {
  return {
    name: 'inline-css-renderer-blaze',
    apply: 'build',
    closeBundle() {
      const dir = resolve(import.meta.dirname, 'dist');
      const cssPath = resolve(dir, 'blaze.css');
      const jsPath = resolve(dir, 'blaze.js');
      if (!existsSync(cssPath) || !existsSync(jsPath)) return;
      const cssContent = readFileSync(cssPath, 'utf-8');
      const jsContent = readFileSync(jsPath, 'utf-8');
      const iife =
        `(function(){` +
        `if(typeof document==='undefined')return;` +
        `if(window.__ESHEET_RENDERER_BLAZE_CSS_INJECTED)return;` +
        `if(!document.querySelector('#esheet-renderer-blaze-styles')){` +
        `var s=document.createElement('style');` +
        `s.id='esheet-renderer-blaze-styles';` +
        `s.textContent=${JSON.stringify(cssContent)};` +
        `document.head.appendChild(s);}` +
        `window.__ESHEET_RENDERER_BLAZE_CSS_INJECTED=true;` +
        `})();\n`;
      writeFileSync(jsPath, iife + jsContent);
      unlinkSync(cssPath);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/renderer-blaze',
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.lib.json', rollupTypes: true }),
    inlineCssBlaze(),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.tsx'),
      name: 'EsheetRendererBlaze',
      fileName: 'blaze',
      formats: ['es'] as LibraryFormats[],
    },
    rollupOptions: {
      external: [],
    },
    cssCodeSplit: false,
    sourcemap: false,
  },
}));
