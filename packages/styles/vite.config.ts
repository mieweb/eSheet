import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type LibraryFormats } from 'vite';

function inlineCss(): import('vite').Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    closeBundle() {
      const cssPath = resolve(import.meta.dirname, 'src/index.output.css');
      const jsPath = resolve(import.meta.dirname, 'dist/index.js');
      const outputCssPath = resolve(import.meta.dirname, 'dist/styles.css');
      if (!existsSync(cssPath) || !existsSync(jsPath)) return;

      const cssContent = readFileSync(cssPath, 'utf-8');
      const jsContent = readFileSync(jsPath, 'utf-8');
      const injector =
        `(function(){` +
        `if(typeof document==='undefined')return;` +
        `if(!document.querySelector('#esheet-styles')){` +
        `var s=document.createElement('style');` +
        `s.id='esheet-styles';` +
        `s.textContent=${JSON.stringify(cssContent)};` +
        `document.head.appendChild(s);}` +
        `})();\n`;

      copyFileSync(cssPath, outputCssPath);
      writeFileSync(jsPath, injector + jsContent);
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [inlineCss()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'EsheetStyles',
      fileName: 'index',
      formats: ['es'] as LibraryFormats[],
    },
    emptyOutDir: true,
    sourcemap: false,
  },
});
