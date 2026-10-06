import { parseShard, searchCatalog, type CodifyShard } from './engine.js';
import type { CatalogOption } from '../index.js';

export interface CatalogLoadRequest {
  type: 'catalog-load';
  id: number;
  key: string;
  url: string;
  sha256: string;
  bytes: number;
  rowCount: number;
  dataset: string;
  locale: string;
}

export type CatalogRequest =
  | CatalogLoadRequest
  | {
      type: 'catalog-search';
      id: number;
      key: string;
      query: string;
      filters: Record<string, string>;
      limit?: number;
    }
  | { type: 'catalog-clear' };

export type CatalogReply =
  | { type: 'catalog-ready'; id: number; key: string }
  | {
      type: 'catalog-results';
      id: number;
      key: string;
      options: CatalogOption[];
    }
  | { type: 'catalog-error'; id: number; key: string; message: string };

export interface CatalogLimits {
  maxCompressedBytes?: number;
  maxDecompressedBytes?: number;
}

async function readBounded(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Catalog exceeds byte limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

/** Shared medical/catalog decompressor; catalogs supply a streaming size cap. */
export async function maybeGunzip(
  buf: ArrayBuffer,
  maxBytes = Infinity
): Promise<ArrayBuffer> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) {
    if (buf.byteLength > maxBytes)
      throw new Error('Catalog exceeds byte limit');
    return buf;
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'shard is gzip-compressed but this browser lacks DecompressionStream — serve the .mcdx shards uncompressed for this browser'
    );
  }
  const body = new Response(buf).body;
  if (!body) throw new Error('could not stream shard for gzip decompression');
  return readBounded(
    body.pipeThrough(new DecompressionStream('gzip')),
    maxBytes
  );
}

/** Isolated in-memory cache: no clinical shards, OPFS, or search-time HTTP. */
export function createCatalogHandler(
  postMessage: (reply: CatalogReply) => void,
  limits: CatalogLimits = {}
): (message: CatalogRequest) => Promise<void> {
  const maxCompressed = limits.maxCompressedBytes ?? 32 * 1024 * 1024;
  const maxDecompressed = limits.maxDecompressedBytes ?? 128 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maxCompressed) ||
    maxCompressed <= 0 ||
    !Number.isSafeInteger(maxDecompressed) ||
    maxDecompressed <= 0
  )
    throw new Error('Invalid catalog byte limits');
  let generation = 0;
  const catalogs = new Map<
    string,
    { identity: string; promise: Promise<CodifyShard> }
  >();

  const load = async (msg: CatalogLoadRequest): Promise<CodifyShard> => {
    if (
      !/^[a-f0-9]{64}$/i.test(msg.sha256) ||
      !Number.isSafeInteger(msg.bytes) ||
      msg.bytes <= 0 ||
      msg.bytes > maxCompressed ||
      !Number.isSafeInteger(msg.rowCount) ||
      msg.rowCount < 0 ||
      !msg.dataset ||
      !msg.locale ||
      !msg.key
    )
      throw new Error('Invalid catalog manifest entry');
    const response = await fetch(msg.url);
    if (!response.ok) throw new Error(`Catalog: HTTP ${response.status}`);
    if (!response.body) throw new Error('Catalog response has no body');
    const bytes = await readBounded(
      response.body,
      Math.min(msg.bytes, maxCompressed)
    );
    if (bytes.byteLength !== msg.bytes)
      throw new Error('Catalog byte count mismatch');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    if (sha256 !== msg.sha256.toLowerCase())
      throw new Error('Catalog SHA-256 mismatch');
    const shard = parseShard(await maybeGunzip(bytes, maxDecompressed));
    if (
      !shard.catalog ||
      shard.domain !== msg.dataset ||
      shard.locale !== msg.locale ||
      shard.docCount !== msg.rowCount ||
      shard.codetypes.length !== 1 ||
      shard.codetypes[0] !== 'catalog' ||
      shard.codeBlob.length !== 0
    )
      throw new Error('Catalog metadata mismatch');
    return shard;
  };

  return async (msg) => {
    if (msg.type === 'catalog-clear') {
      generation++;
      catalogs.clear();
      return;
    }
    const currentGeneration = generation;
    try {
      if (msg.type === 'catalog-load') {
        const identity = JSON.stringify([
          msg.url,
          msg.sha256,
          msg.bytes,
          msg.rowCount,
          msg.dataset,
          msg.locale,
        ]);
        let entry = catalogs.get(msg.key);
        if (entry && entry.identity !== identity)
          throw new Error('Catalog key already bound to different metadata');
        if (!entry) {
          const promise = load(msg);
          entry = { identity, promise };
          catalogs.set(msg.key, entry);
          // Rejections are retryable; old loads must not delete a new generation.
          void promise.catch(() => {
            if (catalogs.get(msg.key)?.promise === promise)
              catalogs.delete(msg.key);
          });
        }
        await entry.promise;
        if (currentGeneration !== generation)
          throw new Error('Catalog load cleared');
        postMessage({ type: 'catalog-ready', id: msg.id, key: msg.key });
      } else {
        const entry = catalogs.get(msg.key);
        if (!entry) throw new Error('Catalog is not loaded');
        const shard = await entry.promise;
        if (currentGeneration !== generation)
          throw new Error('Catalog search cleared');
        const options = searchCatalog(shard, msg.query, msg.filters, msg.limit);
        postMessage({
          type: 'catalog-results',
          id: msg.id,
          key: msg.key,
          options,
        });
      }
    } catch (error) {
      postMessage({
        type: 'catalog-error',
        id: msg.id,
        key: msg.key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
