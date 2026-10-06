import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';
import { test } from 'node:test';
import { build } from 'vite';
import { buildMcdxShard } from '@esheet/catalog/compiler';
import {
  findByCodes,
  maybeGunzip,
  parseShard,
  searchCatalog,
  searchShards,
} from '@esheet/catalog/runtime';

function catalogAsset() {
  return Uint8Array.from(
    buildMcdxShard({
      domain: 'Locations',
      locale: 'en',
      catalog: true,
      docs: [
        {
          fullid: '001',
          codetype: 'catalog',
          fullcode: '',
          label: 'São Paulo office',
          attributes: { Country: 'BR', Population: '0012' },
        },
        {
          fullid: '002',
          codetype: 'catalog',
          fullcode: '',
          label: 'Shared office',
          attributes: {},
        },
      ],
    })
  );
}

test('production writer roundtrips through catalog parse/search', async () => {
  const shard = parseShard(await maybeGunzip(catalogAsset().buffer));
  assert.deepEqual(searchCatalog(shard, 'sao pau', { Country: 'BR' }), [
    {
      id: '001',
      value: 'São Paulo office',
      attributes: { Country: 'BR', Population: '0012' },
    },
  ]);
  assert.deepEqual(searchCatalog(shard, 'office', { Country: 'US' }), [
    { id: '002', value: 'Shared office', attributes: {} },
  ]);
});

test('production writer preserves medical search and saved-code lookup', async () => {
  const payload = Uint8Array.from(
    buildMcdxShard({
      domain: 'condition',
      locale: 'en',
      docs: [
        {
          fullid: 'icd-1',
          codetype: 'ICD10',
          fullcode: 'E11.9',
          label: 'Diabetes mellitus',
        },
      ],
    })
  );
  const shard = parseShard(await maybeGunzip(payload.buffer));
  assert.equal(searchShards([shard], 'diab')[0].fullid, 'icd-1');
  assert.equal(searchShards([shard], 'E11')[0].viaCode, true);
  assert.equal(findByCodes([shard], ['ICD10|E11.9'])[0].fullid, 'icd-1');
});

test('public browser runtime bundles without compiler, Node, React or field-health and does not install a worker', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const entry = `${root}browser-runtime-fixture.js`;
  const result = await build({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [
      {
        name: 'catalog-runtime-fixture',
        resolveId: (id) => (id === entry ? id : undefined),
        load: (id) =>
          id === entry ? "export * from '@esheet/catalog/runtime';" : undefined,
      },
    ],
    build: {
      write: false,
      lib: { entry, name: 'CatalogRuntime', formats: ['iife'] },
    },
  });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap((r) =>
    r.output.filter((output) => output.type === 'chunk')
  );
  assert.equal(chunks.length, 1);
  const [chunk] = chunks;
  assert.deepEqual(chunk.imports, []);
  assert.deepEqual(chunk.dynamicImports, []);
  for (const id of Object.keys(chunk.modules)) {
    assert.doesNotMatch(
      id,
      /field-health|compiler\.[jt]s|writer\.[jt]s|csv-parse|node:|node_modules\/.*react/
    );
  }
  const sentinel = () => assert.fail('main-thread import installed a worker');
  const context = createContext({
    TextDecoder,
    onmessage: sentinel,
    Worker: sentinel,
    postMessage: sentinel,
  });
  new Script(chunk.code).runInContext(context);
  assert.equal(context.onmessage, sentinel);
  assert.equal(context.CatalogRuntime.normalize('São Paulo'), 'sao paulo');
  assert.deepEqual(Object.keys(context.CatalogRuntime).sort(), [
    'billableMask',
    'createCatalogHandler',
    'familyKey',
    'familyTerm',
    'findByCodes',
    'maybeGunzip',
    'normalize',
    'parseShard',
    'searchCatalog',
    'searchShards',
  ]);
});

test('public worker is a standalone executable asset with load/search/clear and correlated errors', async () => {
  const workerUrl = import.meta.resolve('@esheet/catalog/worker');
  assert.equal(
    workerUrl,
    new URL('../dist/catalog.worker.js', import.meta.url).href
  );
  const code = await readFile(new URL(workerUrl), 'utf8');
  // Static ESM imports fail Script parsing; dynamic imports are forbidden too.
  assert.doesNotMatch(code, /\bimport\s*\(|field-health|node:|\brequire\s*\(/);
  const bytes = catalogAsset();
  const replies = [];
  let fetchCount = 0;
  const context = createContext({
    TextDecoder,
    Response,
    DecompressionStream,
    crypto: webcrypto,
    fetch: async () => {
      fetchCount++;
      return new Response(bytes);
    },
    postMessage: (reply) => replies.push(JSON.parse(JSON.stringify(reply))),
  });
  new Script(code).runInContext(context);
  assert.equal(typeof context.onmessage, 'function');
  const request = {
    type: 'catalog-load',
    id: 1,
    key: 'demo:Locations:en',
    url: '/catalogs/locations.mcdx',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
    rowCount: 2,
    dataset: 'Locations',
    locale: 'en',
  };
  await context.onmessage({ data: request });
  assert.deepEqual(replies.pop(), {
    type: 'catalog-ready',
    id: 1,
    key: request.key,
  });
  const search = {
    type: 'catalog-search',
    id: 2,
    key: request.key,
    query: 'sao pau',
    filters: { Country: 'BR' },
  };
  await context.onmessage({ data: search });
  assert.deepEqual(replies.pop(), {
    type: 'catalog-results',
    id: 2,
    key: request.key,
    options: [
      {
        id: '001',
        value: 'São Paulo office',
        attributes: { Country: 'BR', Population: '0012' },
      },
    ],
  });
  assert.equal(fetchCount, 1);
  await context.onmessage({ data: { type: 'catalog-clear' } });
  assert.equal(replies.length, 0);
  await context.onmessage({ data: { ...search, id: 3 } });
  assert.deepEqual(replies.pop(), {
    type: 'catalog-error',
    id: 3,
    key: request.key,
    message: 'Catalog is not loaded',
  });
  await context.onmessage({
    data: { ...request, id: 4, sha256: '0'.repeat(64) },
  });
  assert.deepEqual(replies.pop(), {
    type: 'catalog-error',
    id: 4,
    key: request.key,
    message: 'Catalog SHA-256 mismatch',
  });
});
