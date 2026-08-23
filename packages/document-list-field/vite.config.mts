/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

// React is CJS, so vitest node-resolves it from each importer's own tree — a
// linked @mieweb/ui checkout would load a second copy and every hook would
// read a null dispatcher. Aliasing pins each entry to this workspace's copy.
const require = createRequire(import.meta.url);
const packageDir = (name: string): string =>
  path.dirname(require.resolve(`${name}/package.json`));
const reactDir = packageDir('react');
const reactDomDir = packageDir('react-dom');

function inlineCssDocumentListField(): import('vite').Plugin {
  return {
    name: 'inline-css-document-list-field',
    apply: 'build',
    closeBundle() {
      const cssPath = path.resolve(import.meta.dirname, 'dist/index.css');
      const jsPath = path.resolve(import.meta.dirname, 'dist/index.js');
      if (!existsSync(cssPath) || !existsSync(jsPath)) return;

      const css = readFileSync(cssPath, 'utf-8');
      const js = readFileSync(jsPath, 'utf-8');
      const injectCss =
        `(function(){` +
        `if(typeof document==='undefined')return;` +
        `if(document.querySelector('#esheet-document-list-field-styles'))return;` +
        `var s=document.createElement('style');` +
        `s.id='esheet-document-list-field-styles';` +
        `s.textContent=${JSON.stringify(css)};` +
        `document.head.appendChild(s);` +
        `})();\n`;

      writeFileSync(jsPath, injectCss + js);
      unlinkSync(cssPath);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/document-list-field',
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    inlineCssDocumentListField(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    cssCodeSplit: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@esheet/document-list-field',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: [
        '@esheet/core',
        '@esheet/fields',
        '@mieweb/datavis',
        '@mieweb/ui',
        '@mieweb/ui/datavis',
        'ag-grid-community',
        'ag-grid-react',
        'datavis-ace',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'tslib',
      ],
    },
  },
  test: {
    name: '@esheet/document-list-field',
    watch: false,
    passWithNoTests: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    alias: [
      { find: /^react$/, replacement: reactDir },
      { find: /^react\/(.*)$/, replacement: `${reactDir}/$1` },
      { find: /^react-dom$/, replacement: reactDomDir },
      { find: /^react-dom\/(.*)$/, replacement: `${reactDomDir}/$1` },
    ],
  },
}));
