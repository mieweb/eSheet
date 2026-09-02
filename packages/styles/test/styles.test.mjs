import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputUrl = new URL('../dist/index.js', import.meta.url);
const stylesUrl = new URL('../dist/styles.css', import.meta.url);

test('the shared stylesheet contains responsive utility pairs once', async () => {
  const css = await readFile(stylesUrl, 'utf8');

  assert.equal(css.match(/\.ms\\:hidden\s*\{/g)?.length, 1);
  assert.equal(css.match(/\.ms\\:lg\\:block\s*\{/g)?.length, 1);
  assert.equal(css.match(/\.ms\\:lg\\:flex\s*\{/g)?.length, 1);
});

test('the runtime entry is safe during server rendering', async () => {
  delete globalThis.document;
  await import(`${outputUrl.href}?ssr`);
});

test('the runtime entry injects one shared style element', async () => {
  const elements = [];
  globalThis.document = {
    querySelector(selector) {
      return elements.find((element) => `#${element.id}` === selector) ?? null;
    },
    createElement() {
      return {};
    },
    head: {
      appendChild(element) {
        elements.push(element);
      },
    },
  };

  await import(`${outputUrl.href}?first`);
  await import(`${outputUrl.href}?second`);

  assert.equal(elements.length, 1);
  assert.equal(elements[0].id, 'esheet-styles');
  assert.match(elements[0].textContent, /\.ms\\:lg\\:flex/);

  delete globalThis.document;
});
