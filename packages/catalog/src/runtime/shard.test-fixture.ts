import { normalize } from './engine.js';

export interface FixtureRow {
  id: string;
  label: string;
  code?: string;
  attributes?: Record<string, string>;
}

export interface FixtureMeta {
  domain: string;
  locale?: string;
  catalog?: boolean;
  docCount: number;
  tokenCount: number;
  codetypes: string[];
  sections: Record<string, [number, number]>;
}

/** Tiny independent reader fixture, not a second production compiler. */
export function shardFixture(
  rows: FixtureRow[],
  options: { medical?: boolean; version?: number; attributes?: boolean } = {}
): ArrayBuffer {
  const te = new TextEncoder();
  const sections: Record<string, Uint8Array | Uint32Array> = {};
  const pack = (name: string, values: string[]) => {
    const offsets = [0];
    const encoded = values.map((v) => te.encode(v));
    for (const bytes of encoded) offsets.push(offsets.at(-1)! + bytes.length);
    const blob = new Uint8Array(offsets.at(-1)!);
    encoded.forEach((bytes, i) => blob.set(bytes, offsets[i]));
    sections[`${name}Blob`] = blob;
    sections[`${name}Offsets`] = new Uint32Array(offsets);
  };
  const words = rows.map((r) => normalize(r.label).split(' ').filter(Boolean));
  const tokens = [...new Set(words.flat())].sort();
  const postStart = [0];
  const postings: number[] = [];
  for (const token of tokens) {
    words.forEach((list, d) => {
      if (list.includes(token)) postings.push(d * 2);
    });
    postStart.push(postings.length);
  }
  pack('token', tokens);
  pack(
    'label',
    rows.map((r) => r.label)
  );
  pack(
    'code',
    rows.map((r) => r.code ?? '')
  );
  pack(
    'fullid',
    rows.map((r) => r.id)
  );
  if (options.attributes !== false)
    pack(
      'attributes',
      rows.map((r) => JSON.stringify(r.attributes ?? {}))
    );
  sections.postStart = new Uint32Array(postStart);
  sections.postings = new Uint32Array(postings);
  sections.docCodetype = new Uint8Array(rows.length);
  sections.docLen = new Uint8Array(words.map((w) => w.length));
  if (options.version !== 1) {
    sections.docPrior = new Uint8Array(rows.length);
    sections.docFirstTok = new Uint32Array(
      words.map((w) => tokens.indexOf(w[0]))
    );
  }
  const meta: FixtureMeta = {
    domain: options.medical ? 'condition' : 'ChevronLocations',
    ...(options.version === 1 ? {} : { locale: 'en' }),
    ...(options.medical ? {} : { catalog: true }),
    docCount: rows.length,
    tokenCount: tokens.length,
    codetypes: [options.medical ? 'ICD10' : 'catalog'],
    sections: {},
  };
  let offset = 4096;
  for (const [name, bytes] of Object.entries(sections)) {
    offset = Math.ceil(offset / 4) * 4;
    meta.sections[name] = [offset, bytes.byteLength];
    offset += bytes.byteLength;
  }
  const result = new ArrayBuffer(offset);
  const view = new DataView(result);
  view.setUint32(0, 0x4d434458, true);
  view.setUint32(4, options.version ?? 2, true);
  const metadata = te.encode(JSON.stringify(meta));
  view.setUint32(8, metadata.length, true);
  new Uint8Array(result, 12, metadata.length).set(metadata);
  for (const [name, bytes] of Object.entries(sections))
    new Uint8Array(result, meta.sections[name][0], bytes.byteLength).set(
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    );
  return result;
}

export function rewriteMeta(
  buf: ArrayBuffer,
  update: (meta: FixtureMeta) => void
): ArrayBuffer {
  const result = buf.slice(0);
  const view = new DataView(result);
  const meta = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(result, 12, view.getUint32(8, true))
    )
  ) as FixtureMeta;
  update(meta);
  const bytes = new TextEncoder().encode(JSON.stringify(meta));
  view.setUint32(8, bytes.length, true);
  new Uint8Array(result, 12, bytes.length).set(bytes);
  return result;
}
