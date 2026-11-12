/**
 * MCDX v2 writer extracted/adapted from @mieweb/codify scripts/build-index.mjs.
 * Keeps its section ordering, postings, alias flags, priors and gzip level.
 * No medical domain policy lives here. The medical wrapper can adopt this
 * export once @esheet/catalog is published; no sibling-checkout import needed.
 */
import { gzipSync } from 'node:zlib';

export interface McdxDocument {
  fullid: string;
  codetype: string;
  fullcode: string;
  label: string;
  /** Defaults to label; catalogs supply their configured search columns. */
  searchText?: string;
  attributes?: Record<string, string>;
}

export interface McdxWriterOptions {
  domain: string;
  locale: string;
  docs: readonly McdxDocument[];
  catalog?: boolean;
  aliasGroups?: readonly {
    phrases: readonly string[];
    singleTokens: readonly string[];
  }[];
  usageByCode?: ReadonlyMap<string, number>;
  usagePhrases?: readonly { phrase: string; count: number }[];
  usageMaxCount?: number;
}

/** Must stay in sync with codify and catalog runtime/engine.ts. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** In-memory gzip payload. Callers own asset naming and atomic publication. */
export function buildMcdxShard(options: McdxWriterOptions): Uint8Array {
  const { docs, domain, locale } = options;
  const codetypes = [...new Set(docs.map((doc) => doc.codetype))];
  if (codetypes.length > 256 || docs.length > 0x7fffffff) {
    throw new Error('MCDX document/codetype count exceeds the v2 format');
  }
  const codetypeIdx = new Map(codetypes.map((type, i) => [type, i]));
  const tokenMap = new Map<string, number[]>();
  const docLens = new Uint8Array(docs.length);
  const docPriors = new Uint8Array(docs.length);
  const docFirst: string[] = [];
  for (let d = 0; d < docs.length; d++) {
    const doc = docs[d];
    const norm = normalize(doc.searchText ?? doc.label);
    const tokens = norm ? norm.split(' ') : [];
    docFirst[d] = tokens[0] ?? '';
    const seen = new Set<string>();
    const addToken = (token: string, alias: number) => {
      if (!token || seen.has(token)) return;
      seen.add(token);
      let list = tokenMap.get(token);
      if (!list) tokenMap.set(token, (list = []));
      list.push((d << 1) | alias);
    };
    for (const token of tokens) addToken(token, 0);
    docLens[d] = Math.min(255, tokens.length);
    const padded = ` ${norm} `;
    let usage =
      options.usageByCode?.get(`${doc.codetype}|${doc.fullcode}`) ?? 0;
    for (const prior of options.usagePhrases ?? []) {
      if (prior.count > usage && padded.includes(prior.phrase)) {
        usage = prior.count;
      }
    }
    const max = options.usageMaxCount ?? 0;
    docPriors[d] =
      usage && max
        ? Math.min(
            255,
            Math.round((255 * Math.log(1 + usage)) / Math.log(1 + max))
          )
        : 0;
    for (const group of options.aliasGroups ?? []) {
      const hit = group.phrases.some((phrase) =>
        phrase.includes(' ') ? padded.includes(` ${phrase} `) : seen.has(phrase)
      );
      if (hit) for (const token of group.singleTokens) addToken(token, 1);
    }
  }

  const tokens = [...tokenMap.keys()].sort();
  const tokenId = new Map(tokens.map((token, i) => [token, i]));
  const docFirstTok = docFirst.map((token) => tokenId.get(token) ?? 0xffffffff);
  const tokenOffsets: number[] = [0];
  const postStart: number[] = [0];
  const tokenEncoded = tokens.map((token) => Buffer.from(token));
  const postings: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    tokenOffsets.push(tokenOffsets[i] + tokenEncoded[i].length);
    for (const posting of tokenMap.get(tokens[i])!) postings.push(posting);
    postStart.push(postings.length);
  }

  const packStrings = (getter: (doc: McdxDocument) => string) => {
    const encoded = docs.map((doc) => Buffer.from(getter(doc)));
    const offsets = [0];
    for (const value of encoded) offsets.push(offsets.at(-1)! + value.length);
    return { blob: Buffer.concat(encoded), offsets: u32(offsets) };
  };
  const label = packStrings((doc) => doc.label);
  const code = packStrings((doc) => doc.fullcode);
  const fullid = packStrings((doc) => doc.fullid);
  const sectionsSrc: Record<string, Buffer> = {
    tokenBlob: Buffer.concat(tokenEncoded),
    tokenOffsets: u32(tokenOffsets),
    postStart: u32(postStart),
    postings: u32(postings),
    labelBlob: label.blob,
    labelOffsets: label.offsets,
    codeBlob: code.blob,
    codeOffsets: code.offsets,
    fullidBlob: fullid.blob,
    fullidOffsets: fullid.offsets,
    docCodetype: Buffer.from(docs.map((doc) => codetypeIdx.get(doc.codetype)!)),
    docLen: Buffer.from(docLens),
    docPrior: Buffer.from(docPriors),
    docFirstTok: u32(docFirstTok),
  };
  if (docs.some((doc) => doc.attributes !== undefined)) {
    const attributes = packStrings((doc) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(doc.attributes ?? {}).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      )
    );
    sectionsSrc.attributesBlob = attributes.blob;
    sectionsSrc.attributesOffsets = attributes.offsets;
  }
  const meta = {
    domain,
    locale,
    docCount: docs.length,
    tokenCount: tokens.length,
    postingsCount: postings.length,
    codetypes,
    ...(options.catalog ? { catalog: true } : {}),
    sections: {} as Record<string, [number, number]>,
  };
  // The metadata contains its own offsets: retain codify's fixed-point layout.
  let metaJson = '';
  let headerLen = 0;
  let prevHeaderLen = -1;
  while (headerLen !== prevHeaderLen) {
    prevHeaderLen = headerLen;
    let off = headerLen;
    for (const [name, buf] of Object.entries(sectionsSrc)) {
      off = align4(off);
      meta.sections[name] = [off, buf.length];
      off += buf.length;
    }
    metaJson = JSON.stringify(meta);
    headerLen = align4(12 + Buffer.byteLength(metaJson));
  }
  const totalLen = Object.values(meta.sections).reduce(
    (max, [offset, length]) => Math.max(max, offset + length),
    headerLen
  );
  const out = Buffer.alloc(align4(totalLen));
  out.writeUInt32LE(0x4d434458, 0);
  out.writeUInt32LE(2, 4);
  const metaBuf = Buffer.from(metaJson);
  out.writeUInt32LE(metaBuf.length, 8);
  metaBuf.copy(out, 12);
  for (const [name, buf] of Object.entries(sectionsSrc)) {
    buf.copy(out, meta.sections[name][0]);
  }
  return gzipSync(out, { level: 9 });
}

function align4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

function u32(values: readonly number[]): Buffer {
  const out = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => out.writeUInt32LE(value >>> 0, i * 4));
  return out;
}
