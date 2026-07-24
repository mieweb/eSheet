/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

function inlineCssFieldHealth(): import('vite').Plugin {
  return {
    name: 'inline-css-field-health',
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
        `if(document.querySelector('#esheet-field-health-styles'))return;` +
        `var s=document.createElement('style');` +
        `s.id='esheet-field-health-styles';` +
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
  cacheDir: '../../node_modules/.vite/packages/field-health',
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    inlineCssFieldHealth(),
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
      name: '@esheet/field-health',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        '@esheet/core',
        '@esheet/fields',
        '@mieweb/ui',
        'lucide-react',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'tslib',
      ],
    },
  },
  test: {
    name: '@esheet/field-health',
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
