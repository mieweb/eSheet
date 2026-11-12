// Handler protocol coverage; the built worker entry is tested separately.
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  createCatalogHandler,
  maybeGunzip,
  type CatalogLoadRequest,
  type CatalogReply,
} from './catalog-worker.js';
import { rewriteMeta, shardFixture } from './shard.test-fixture.js';

function asset(
  buffer = shardFixture([
    { id: '001', label: 'Office Angola', attributes: { Country: 'AO' } },
  ])
) {
  const bytes = Uint8Array.from(gzipSync(new Uint8Array(buffer)));
  const request: CatalogLoadRequest = {
    type: 'catalog-load',
    id: 1,
    key: 'demo:ChevronLocations:en:hash',
    url: '/catalogs/locations.mcdx',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    rowCount: 1,
    dataset: 'ChevronLocations',
    locale: 'en',
  };
  return { bytes, request };
}

describe('catalog worker requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deduplicates concurrent loads and searches locally with correlated replies', async () => {
    const { bytes, request } = asset();
    const fetch = vi.fn(async () => new Response(bytes));
    vi.stubGlobal('fetch', fetch);
    const reply = vi.fn<(message: CatalogReply) => void>();
    const handle = createCatalogHandler(reply);
    await Promise.all([handle(request), handle({ ...request, id: 2 })]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls.map(([r]) => r)).toEqual([
      { type: 'catalog-ready', id: 1, key: request.key },
      { type: 'catalog-ready', id: 2, key: request.key },
    ]);
    fetch.mockRejectedValue(new Error('Offline'));
    await handle({
      type: 'catalog-search',
      id: 3,
      key: request.key,
      query: 'off',
      filters: { Country: 'AO' },
    });
    expect(reply).toHaveBeenLastCalledWith({
      type: 'catalog-results',
      id: 3,
      key: request.key,
      options: [
        { id: '001', value: 'Office Angola', attributes: { Country: 'AO' } },
      ],
    });
    await handle({
      type: 'catalog-search',
      id: 4,
      key: request.key,
      query: '',
      filters: {},
      limit: 0,
    });
    expect(reply).toHaveBeenLastCalledWith({
      type: 'catalog-results',
      id: 4,
      key: request.key,
      options: [],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { sha256: '0'.repeat(64) },
    { bytes: 1 },
    { bytes: 9999 },
    { rowCount: 2 },
    { dataset: 'Other' },
    { locale: 'es' },
  ])('rejects manifest mismatch %j and permits a retry', async (change) => {
    const { bytes, request } = asset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(bytes))
    );
    const reply = vi.fn();
    const handle = createCatalogHandler(reply);
    await handle({ ...request, ...change });
    expect(reply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'catalog-error',
        id: 1,
        key: request.key,
      })
    );
    await handle({ ...request, id: 2 });
    expect(reply).toHaveBeenLastCalledWith({
      type: 'catalog-ready',
      id: 2,
      key: request.key,
    });
  });

  it('rejects clinical shards and malformed binaries even with matching digests', async () => {
    for (const buffer of [
      rewriteMeta(shardFixture([{ id: '1', label: 'Office' }]), (meta) => {
        delete meta.catalog;
      }),
      new ArrayBuffer(20),
    ]) {
      const { bytes, request } = asset(buffer);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(bytes))
      );
      const reply = vi.fn();
      await createCatalogHandler(reply)(request);
      expect(reply).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'catalog-error' })
      );
    }
  });

  it('enforces compressed and decompressed safety caps', async () => {
    const { bytes, request } = asset();
    const fetch = vi.fn(async () => new Response(bytes));
    vi.stubGlobal('fetch', fetch);
    const reply = vi.fn();
    await createCatalogHandler(reply, { maxCompressedBytes: 1 })(request);
    expect(fetch).not.toHaveBeenCalled();
    await createCatalogHandler(reply, { maxDecompressedBytes: 100 })(request);
    expect(reply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'catalog-error',
        message: expect.stringContaining('byte limit'),
      })
    );
  });

  it('does not repopulate cleared catalogs when an old load finishes', async () => {
    const { bytes, request } = asset();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          })
      )
    );
    const reply = vi.fn();
    const handle = createCatalogHandler(reply);
    const pending = handle(request);
    await handle({ type: 'catalog-clear' });
    finish(new Response(bytes));
    await pending;
    expect(reply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'catalog-error',
        message: 'Catalog load cleared',
      })
    );
    await handle({
      type: 'catalog-search',
      id: 2,
      key: request.key,
      query: '',
      filters: {},
    });
    expect(reply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'catalog-error',
        message: 'Catalog is not loaded',
      })
    );
  });

  it('keeps different configuration keys isolated and rejects key reuse with changed metadata', async () => {
    const first = asset();
    const second = asset(shardFixture([{ id: '002', label: 'Other office' }]));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(url === '/other.mcdx' ? second.bytes : first.bytes)
      )
    );
    const reply = vi.fn();
    const handle = createCatalogHandler(reply);
    await handle(first.request);
    await handle({ ...second.request, url: '/other.mcdx' });
    expect(reply).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'catalog-error' })
    );
    await handle({
      ...second.request,
      key: 'other-config',
      url: '/other.mcdx',
    });
    await handle({
      type: 'catalog-search',
      id: 3,
      key: first.request.key,
      query: '',
      filters: {},
    });
    expect(reply.mock.lastCall?.[0].options[0].id).toBe('001');
    await handle({
      type: 'catalog-search',
      id: 4,
      key: 'other-config',
      query: '',
      filters: {},
    });
    expect(reply.mock.lastCall?.[0].options[0].id).toBe('002');
  });

  it('retains uncompressed and medical gzip decompression support', async () => {
    const plain = shardFixture([{ id: '1', label: 'Diabetes', code: 'E11' }], {
      medical: true,
    });
    expect(await maybeGunzip(plain)).toBe(plain);
    const compressed = Uint8Array.from(gzipSync(new Uint8Array(plain))).buffer;
    expect(await maybeGunzip(compressed)).toEqual(plain);
  });
});
