/**
 * Web Worker for the offline code lookup: fetches .mcdx shards (with OPFS
 * persistence), holds the parsed typed arrays, answers search queries off the
 * UI thread.
 */
/* global FileSystemDirectoryHandle */
import {
  parseShard,
  searchShards,
  findByCodes,
  type CodifyShard,
} from './engine.js';

interface WorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
}

const workerScope = globalThis as unknown as WorkerScope;

const shards = new Map<string, CodifyShard>();

export interface ProgramMeta {
  kind?: 'surveillance' | 'fitness' | 'credential' | 'quality';
  periodicityMonths?: number;
  ageMin?: number;
  ageMax?: number;
  sex?: 'M' | 'F';
  orders?: (string | { key?: string; alt?: string[]; after?: string[] })[];
}

function orderKeys(program: ProgramMeta | null): string[] {
  return (program?.orders ?? []).flatMap((o) =>
    typeof o === 'string' ? [o] : o.alt ?? (o.key ? [o.key] : [])
  );
}

let programs: Record<string, ProgramMeta> | null = null;

interface ManifestShard {
  domain: string;
  file: string;
  bytes: number;
  docCount: number;
}

interface Manifest {
  version?: number;
  locale?: string;
  builtAt?: string;
  shards: ManifestShard[];
}

function cacheKey(baseUrl: string): string {
  return encodeURIComponent(baseUrl.replace(/\/+$/, ''));
}

async function getCacheDir(
  baseUrl: string,
  create: boolean
): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory)
      return null;
    const root = await navigator.storage.getDirectory();
    const cacheRoot = await root.getDirectoryHandle('codify-cache', { create });
    return await cacheRoot.getDirectoryHandle(cacheKey(baseUrl), { create });
  } catch {
    return null;
  }
}

async function readCachedFile(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<ArrayBuffer | null> {
  try {
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

interface SyncAccessHandle {
  truncate(size: number): void;
  write(buffer: Uint8Array, options?: { at: number }): number;
  flush(): void;
  close(): void;
}

async function writeCachedFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  buf: ArrayBuffer
): Promise<void> {
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const access = await (
      handle as unknown as {
        createSyncAccessHandle(): Promise<SyncAccessHandle>;
      }
    ).createSyncAccessHandle();
    try {
      access.truncate(0);
      access.write(new Uint8Array(buf), { at: 0 });
      access.flush();
    } finally {
      access.close();
    }
  } catch {
    // best-effort cache
  }
}

async function readCachedManifest(
  dir: FileSystemDirectoryHandle
): Promise<Manifest | null> {
  const buf = await readCachedFile(dir, 'manifest.json');
  if (!buf) return null;
  try {
    return JSON.parse(new TextDecoder().decode(buf)) as Manifest;
  } catch {
    return null;
  }
}

async function maybeGunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  if (buf.byteLength < 2) return buf;
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'shard is gzip-compressed but this browser lacks DecompressionStream — serve the .mcdx shards uncompressed for this browser'
    );
  }
  const body = new Response(buf).body;
  if (!body) throw new Error('could not stream shard for gzip decompression');
  const stream = body.pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

function shardUnchanged(
  fresh: Manifest,
  cached: Manifest | null,
  sh: ManifestShard
): boolean {
  if (!cached) return false;
  if (fresh.builtAt !== cached.builtAt || fresh.version !== cached.version)
    return false;
  const prev = cached.shards.find((c) => c.domain === sh.domain);
  return !!prev && prev.file === sh.file && prev.bytes === sh.bytes;
}

async function load(baseUrl: string, domains?: string[], programsUrl?: string) {
  const dir = await getCacheDir(baseUrl, true);
  const cachedManifest = dir ? await readCachedManifest(dir) : null;

  let manifest: Manifest | null = null;
  let offline = false;
  try {
    const res = await fetch(`${baseUrl}/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
    manifest = (await res.json()) as Manifest;
  } catch (err) {
    if (cachedManifest) {
      manifest = cachedManifest;
      offline = true;
    } else {
      throw err;
    }
  }

  const wanted = manifest.shards.filter(
    (sh) => !domains || domains.includes(sh.domain)
  );
  const totalBytes = wanted.reduce((n, sh) => n + sh.bytes, 0);
  let loadedBytes = 0;
  let anyFromNetwork = false;

  for (const sh of wanted) {
    let buf: ArrayBuffer | null = null;
    const cacheable =
      dir && (offline || shardUnchanged(manifest, cachedManifest, sh));
    if (cacheable) buf = await readCachedFile(dir, sh.file);
    if (!buf) {
      if (offline) throw new Error(`Offline and ${sh.file} not cached`);
      const res = await fetch(`${baseUrl}/${sh.file}`);
      if (!res.ok) throw new Error(`Failed to fetch ${sh.file}: ${res.status}`);
      buf = await res.arrayBuffer();
      anyFromNetwork = true;
      if (dir) await writeCachedFile(dir, sh.file, buf);
    }
    shards.set(sh.domain, parseShard(await maybeGunzip(buf)));
    loadedBytes += sh.bytes;
    workerScope.postMessage({
      type: 'progress',
      domain: sh.domain,
      loadedBytes,
      totalBytes,
    });
  }

  if (dir && !offline && anyFromNetwork) {
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    await writeCachedFile(
      dir,
      'manifest.json',
      bytes.buffer.slice(0, bytes.byteLength) as ArrayBuffer
    );
  }

  try {
    const sources = programsUrl
      ? [programsUrl]
      : [`${baseUrl}/programs.json`, `${baseUrl}/order-sets.json`];
    let parsed: {
      programs?: Record<string, ProgramMeta>;
      sets?: Record<string, string[]>;
    } | null = null;
    for (const url of sources) {
      const cacheName = `programs-${cacheKey(url)}.json`;
      let buf: ArrayBuffer | null = null;
      if (!offline) {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) {
            buf = await res.arrayBuffer();
            if (dir) await writeCachedFile(dir, cacheName, buf);
          }
        } catch {
          // try cache below
        }
      }
      if (!buf && dir) buf = await readCachedFile(dir, cacheName);
      if (!buf) continue;
      parsed = JSON.parse(new TextDecoder().decode(buf));
      break;
    }
    if (parsed?.programs) {
      programs = parsed.programs;
    } else if (parsed?.sets) {
      programs = Object.fromEntries(
        Object.entries(parsed.sets).map(([k, orders]) => [k, { orders }])
      );
    }
  } catch {
    programs = null;
  }

  workerScope.postMessage({
    type: 'ready',
    domains: [...shards.keys()],
    docCount: [...shards.values()].reduce((n, s) => n + s.docCount, 0),
    fromCache: !anyFromNetwork,
  });
}

workerScope.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'load') {
    load(msg.baseUrl, msg.domains, msg.programsUrl).catch((err) =>
      workerScope.postMessage({
        type: 'error',
        message: String(err?.message ?? err),
      })
    );
  } else if (msg.type === 'search') {
    const t0 = performance.now();
    const active = msg.domains
      ? [...shards.values()].filter((s) => msg.domains.includes(s.domain))
      : [...shards.values()];
    const limit = msg.limit ?? 20;
    const collapse = msg.collapse === true;
    const opts = {
      boostCodetypes: msg.boostCodetypes as string[] | undefined,
      billableOnly: msg.billableOnly === true,
    };
    let results;
    const prefer: string[] | undefined = msg.prefer;
    if (prefer && prefer.length > 0) {
      const rest = active.filter((s) => !prefer.includes(s.domain));
      const firstAll = prefer
        .flatMap((domain) =>
          searchShards(
            active.filter((s) => s.domain === domain),
            msg.query,
            limit,
            collapse,
            opts
          )
        )
        .filter((r) => !r.viaFuzzy);
      const restAll = searchShards(rest, msg.query, limit, collapse, opts);
      const firstCap =
        restAll.length === 0
          ? limit
          : Math.max(Math.ceil(limit / 2), limit - restAll.length);
      results = firstAll.slice(0, firstCap).concat(restAll).slice(0, limit);
    } else {
      results = searchShards(active, msg.query, limit, collapse, opts);
    }
    workerScope.postMessage({
      type: 'results',
      id: msg.id,
      query: msg.query,
      results,
      tookMs: performance.now() - t0,
    });
  } else if (msg.type === 'orders') {
    const t0 = performance.now();
    const program = programs?.[msg.key] ?? null;
    const results = findByCodes([...shards.values()], orderKeys(program));
    workerScope.postMessage({
      type: 'results',
      id: msg.id,
      query: msg.key,
      results,
      program,
      tookMs: performance.now() - t0,
    });
  } else if (msg.type === 'programs') {
    workerScope.postMessage({ type: 'programs', id: msg.id, programs });
  }
};
