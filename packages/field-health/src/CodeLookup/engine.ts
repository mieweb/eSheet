/**
 * Offline MedicalCodify search engine — parses .mcdx shards (built by
 * scripts/codify/build-index.mjs; see that file for the binary layout) and
 * runs multi-word-prefix BM25-ish scoring with alias and typo support.
 *
 * Runs on the main thread or inside a worker (no DOM access).
 *
 * Full pipeline & design docs:
 *   https://github.com/mieweb/ui/blob/main/src/components/CodeLookup/README.md
 *   (local: ./README.md)
 */

export interface CodifyShard {
  domain: string;
  /** BCP-47-ish locale the shard was built for ('en' when absent, v1) */
  locale: string;
  docCount: number;
  tokenCount: number;
  codetypes: string[];
  tokenBlob: Uint8Array;
  tokenOffsets: Uint32Array;
  postStart: Uint32Array;
  postings: Uint32Array;
  labelBlob: Uint8Array;
  labelOffsets: Uint32Array;
  codeBlob: Uint8Array;
  codeOffsets: Uint32Array;
  fullidBlob: Uint8Array;
  fullidOffsets: Uint32Array;
  docCodetype: Uint8Array;
  docLen: Uint8Array;
  /** Usage prior per doc, log-quantized 0-255 (v2; null for v1 shards) */
  docPrior: Uint8Array | null;
  /** Max usage prior among each token's postings (drives usage-aware prefix
   * expansion; null for v1 shards) */
  tokenPrior: Uint8Array | null;
  /** First token id per doc (0xffffffff = none); drives the leading-prefix
   * bonus. null when the shard predates the section. */
  docFirstTok: Uint32Array | null;
  scoreBuf: Float32Array;
  maskBuf: Uint8Array;
  aliasBuf: Uint8Array;
  fuzzyBuf: Uint8Array;
  touched: Uint32Array;
  /** Lazy cache: 1 = billable (leaf) ICD-10 code; see billableMask() */
  billable?: Uint8Array;
  /** Lazy cache: sorted normalized code keys + doc ids; see codeIndex() */
  codeIndex?: { keys: string[]; docs: Uint32Array };
}

export interface CodifyResult {
  fullid: string;
  label: string;
  codetype: string;
  fullcode: string;
  domain: string;
  score: number;
  /** true when the match came (partly) from an alias token */
  viaAlias: boolean;
  /** true when the match came (partly) from the edit-distance typo fallback */
  viaFuzzy?: boolean;
  /** true when the match came from the code itself (query looked like a code) */
  viaCode?: boolean;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function familyTerm(domain: string, label: string): string {
  let text = label;
  if (domain === 'lab') {
    const br = text.indexOf('[');
    if (br > 0) text = text.slice(0, br);
  }
  const words = normalize(text).split(' ').filter(Boolean);
  const n = domain === 'med' && (words[0]?.length ?? 0) > 2 ? 1 : 2;
  return words.slice(0, n).join(' ');
}

export function familyKey(
  domain: string,
  label: string,
  fullcode: string
): string {
  if (domain === 'condition') {
    if (/^[a-z]\d/i.test(fullcode))
      return 'condition:#' + fullcode.split('.')[0];
    if (/^\d+$/.test(fullcode)) return 'condition:#s' + fullcode;
  }
  if (domain === 'occupational' || domain === 'quality')
    return domain + ':#' + fullcode;
  return domain + ':' + familyTerm(domain, label);
}

export function findByCodes(
  shards: CodifyShard[],
  keys: string[]
): CodifyResult[] {
  const out: CodifyResult[] = [];
  const remaining = new Set(keys);
  for (const s of shards) {
    if (remaining.size === 0) break;
    const wanted = new Map<number, string>();
    s.codetypes.forEach((ct, i) => {
      for (const k of remaining) {
        if (k.startsWith(ct + '|')) {
          wanted.set(i, ct);
          break;
        }
      }
    });
    if (wanted.size === 0) continue;
    for (let d = 0; d < s.docCount && remaining.size > 0; d++) {
      const ct = wanted.get(s.docCodetype[d]);
      if (ct === undefined) continue;
      const code = td.decode(
        s.codeBlob.subarray(s.codeOffsets[d], s.codeOffsets[d + 1])
      );
      const key = ct + '|' + code;
      if (!remaining.has(key)) continue;
      remaining.delete(key);
      out.push({
        fullid: td.decode(
          s.fullidBlob.subarray(s.fullidOffsets[d], s.fullidOffsets[d + 1])
        ),
        label: td.decode(
          s.labelBlob.subarray(s.labelOffsets[d], s.labelOffsets[d + 1])
        ),
        codetype: ct,
        fullcode: code,
        domain: s.domain,
        score: 0,
        viaAlias: false,
      });
    }
  }
  const pos = new Map(keys.map((k, i) => [k, i]));
  out.sort(
    (a, b) =>
      (pos.get(a.codetype + '|' + a.fullcode) ?? 0) -
      (pos.get(b.codetype + '|' + b.fullcode) ?? 0)
  );
  return out;
}

const MAGIC = 0x4d434458;
const PRIOR_WEIGHT = 0.5;
const SHORT_PRIOR_WEIGHT = 3;
const LEAD_BONUS = 2.5;

export function parseShard(buf: ArrayBuffer): CodifyShard {
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('Bad shard magic');
  const version = view.getUint32(4, true);
  if (version !== 1 && version !== 2)
    throw new Error('Unsupported shard version');
  const metaLen = view.getUint32(8, true);
  const meta = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buf, 12, metaLen))
  ) as {
    domain: string;
    locale?: string;
    docCount: number;
    tokenCount: number;
    codetypes: string[];
    sections: Record<string, [number, number]>;
  };
  const u8 = (name: string) => {
    const [off, len] = meta.sections[name];
    return new Uint8Array(buf, off, len);
  };
  const u32 = (name: string) => {
    const [off, len] = meta.sections[name];
    return new Uint32Array(buf, off, len >>> 2);
  };
  const postStart = u32('postStart');
  const postings = u32('postings');
  const docPrior = meta.sections.docPrior ? u8('docPrior') : null;

  let tokenPrior: Uint8Array | null = null;
  if (docPrior) {
    tokenPrior = new Uint8Array(meta.tokenCount);
    for (let t = 0; t < meta.tokenCount; t++) {
      let m = 0;
      const end = postStart[t + 1];
      for (let p = postStart[t]; p < end; p++) {
        const pr = docPrior[postings[p] >>> 1];
        if (pr > m) {
          m = pr;
          if (m === 255) break;
        }
      }
      tokenPrior[t] = m;
    }
  }

  return {
    domain: meta.domain,
    locale: meta.locale ?? 'en',
    docCount: meta.docCount,
    tokenCount: meta.tokenCount,
    codetypes: meta.codetypes,
    tokenBlob: u8('tokenBlob'),
    tokenOffsets: u32('tokenOffsets'),
    postStart,
    postings,
    labelBlob: u8('labelBlob'),
    labelOffsets: u32('labelOffsets'),
    codeBlob: u8('codeBlob'),
    codeOffsets: u32('codeOffsets'),
    fullidBlob: u8('fullidBlob'),
    fullidOffsets: u32('fullidOffsets'),
    docCodetype: u8('docCodetype'),
    docLen: u8('docLen'),
    docPrior,
    tokenPrior,
    docFirstTok: meta.sections.docFirstTok ? u32('docFirstTok') : null,
    scoreBuf: new Float32Array(meta.docCount),
    maskBuf: new Uint8Array(meta.docCount),
    aliasBuf: new Uint8Array(meta.docCount),
    fuzzyBuf: new Uint8Array(meta.docCount),
    touched: new Uint32Array(meta.docCount),
  };
}

const td = new TextDecoder();

function tokenAt(s: CodifyShard, i: number): string {
  return td.decode(
    s.tokenBlob.subarray(s.tokenOffsets[i], s.tokenOffsets[i + 1])
  );
}

function lowerBound(s: CodifyShard, q: string): number {
  let lo = 0;
  let hi = s.tokenCount;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (tokenAt(s, mid) < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function prefixRange(s: CodifyShard, prefix: string): [number, number] {
  const lo = lowerBound(s, prefix);
  const hi = lowerBound(s, prefix + '\uffff');
  return [lo, hi];
}

function within1(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (i === la && i === lb) return true;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return (
      i + 1 < la &&
      a[i] === b[i + 1] &&
      a[i + 1] === b[i] &&
      a.slice(i + 2) === b.slice(i + 2)
    );
  }
  const [shorter, longer] = la < lb ? [a, b] : [b, a];
  return shorter.slice(i) === longer.slice(i + 1);
}

function fuzzyCandidates(s: CodifyShard, q: string, max: number): number[] {
  const out: number[] = [];
  const qLen = q.length;
  for (let i = 0; i < s.tokenCount && out.length < max; i++) {
    const tLen = s.tokenOffsets[i + 1] - s.tokenOffsets[i];
    if (tLen < qLen - 1) continue;
    const tok = tokenAt(s, i);
    const pfx = tok.length > qLen + 1 ? tok.slice(0, qLen + 1) : tok;
    if (within1(q, pfx) || within1(q, tok.slice(0, qLen))) out.push(i);
  }
  return out;
}

const MAX_EXPANSIONS = 128;
const MAX_QUERY_TOKENS = 8;

function topPriorTokens(
  s: CodifyShard,
  lo: number,
  hi: number,
  max: number
): number[] {
  const tp = s.tokenPrior;
  if (!tp) return [];
  const len = (t: number) => s.tokenOffsets[t + 1] - s.tokenOffsets[t];
  const above = (a: number, b: number) => {
    const d = tp[a] - tp[b];
    return d !== 0 ? d > 0 : len(a) < len(b);
  };
  const n = hi - lo;
  if (n <= max) {
    const range: number[] = new Array(n);
    for (let t = lo; t < hi; t++) range[t - lo] = t;
    range.sort((a, b) => (above(a, b) ? -1 : 1));
    return range;
  }
  const heap: number[] = [];
  const siftUp = (start: number) => {
    let i = start;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!above(heap[p], heap[i])) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const siftDown = () => {
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let lowest = i;
      if (l < heap.length && above(heap[lowest], heap[l])) lowest = l;
      if (r < heap.length && above(heap[lowest], heap[r])) lowest = r;
      if (lowest === i) break;
      [heap[lowest], heap[i]] = [heap[i], heap[lowest]];
      i = lowest;
    }
  };
  for (let t = lo; t < hi; t++) {
    if (heap.length < max) {
      heap.push(t);
      siftUp(heap.length - 1);
    } else if (above(t, heap[0])) {
      heap[0] = t;
      siftDown();
    }
  }
  heap.sort((a, b) => (above(a, b) ? -1 : 1));
  return heap;
}

export interface SearchOptions {
  collapse?: boolean;
  boostCodetypes?: string[];
  billableOnly?: boolean;
}

const CODETYPE_BOOST = 3;
const CODE_MATCH_BASE = 1000;

function codeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function codeQueryKey(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === '' || /\s/.test(trimmed)) return null;
  const key = codeKey(trimmed);
  return key.length >= 2 && key.length <= 18 && /\d/.test(key) ? key : null;
}

function codeIndex(s: CodifyShard): { keys: string[]; docs: Uint32Array } {
  if (s.codeIndex) return s.codeIndex;
  const pairs: { key: string; d: number }[] = [];
  for (let d = 0; d < s.docCount; d++) {
    const key = codeKey(
      td.decode(s.codeBlob.subarray(s.codeOffsets[d], s.codeOffsets[d + 1]))
    );
    if (key) pairs.push({ key, d });
  }
  pairs.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  s.codeIndex = {
    keys: pairs.map((p) => p.key),
    docs: new Uint32Array(pairs.map((p) => p.d)),
  };
  return s.codeIndex;
}

const MAX_CODE_SCAN = 1000;

function searchShardCodes(
  s: CodifyShard,
  q: string,
  out: CodifyResult[],
  limit: number,
  opts?: SearchOptions
) {
  const { keys, docs } = codeIndex(s);
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid] < q) lo = mid + 1;
    else hi = mid;
  }
  const billable =
    opts?.billableOnly && s.domain === 'condition' ? billableMask(s) : null;
  let boostIdx: Set<number> | null = null;
  if (opts?.boostCodetypes) {
    const idx = opts.boostCodetypes
      .map((ct) => s.codetypes.indexOf(ct))
      .filter((i) => i >= 0);
    if (idx.length > 0) boostIdx = new Set(idx);
  }
  const end = Math.min(keys.length, lo + MAX_CODE_SCAN);
  for (let i = lo; i < end && keys[i].startsWith(q); i++) {
    const d = docs[i];
    if (billable && billable[d] !== 1) continue;
    const score =
      CODE_MATCH_BASE *
      (q.length / keys[i].length) *
      (boostIdx && boostIdx.has(s.docCodetype[d]) ? CODETYPE_BOOST : 1);
    pushResult(out, s, d, score, false, false, limit * 3, true);
  }
}

export function billableMask(s: CodifyShard): Uint8Array {
  if (s.billable) return s.billable;
  const mask = new Uint8Array(s.docCount);
  const icd = s.codetypes.indexOf('ICD10');
  if (icd >= 0) {
    const entries: { code: string; d: number }[] = [];
    for (let d = 0; d < s.docCount; d++) {
      if (s.docCodetype[d] !== icd) continue;
      entries.push({
        code: td.decode(
          s.codeBlob.subarray(s.codeOffsets[d], s.codeOffsets[d + 1])
        ),
        d,
      });
    }
    entries.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    for (let i = 0; i < entries.length; i++) {
      const cur = entries[i];
      const next = entries[i + 1];
      const hasChild =
        next !== undefined &&
        next.code.length > cur.code.length &&
        next.code.startsWith(cur.code);
      if (!hasChild) mask[cur.d] = 1;
    }
  }
  s.billable = mask;
  return mask;
}

export function searchShards(
  shards: CodifyShard[],
  query: string,
  limit = 20,
  collapse = false,
  opts?: SearchOptions
): CodifyResult[] {
  const qTokens = normalize(query)
    .split(' ')
    .filter(Boolean)
    .slice(0, MAX_QUERY_TOKENS);
  const codeQ = codeQueryKey(query);
  if (qTokens.length === 0 && !codeQ) return [];
  let results: CodifyResult[] = [];

  for (const s of shards) {
    if (qTokens.length > 0)
      searchShard(s, qTokens, results, limit, collapse, opts);
    if (codeQ) searchShardCodes(s, codeQ, results, limit, opts);
  }
  if (codeQ) {
    const best = new Map<string, CodifyResult>();
    for (const r of results) {
      const prev = best.get(r.fullid);
      if (!prev || r.score > prev.score) best.set(r.fullid, r);
    }
    results = [...best.values()];
    if (collapse) {
      const fams = new Map<string, CodifyResult>();
      for (const r of results) {
        const key = familyKey(r.domain, r.label, r.fullcode);
        const prev = fams.get(key);
        if (!prev || r.score > prev.score) fams.set(key, r);
      }
      results = [...fams.values()];
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function searchShard(
  s: CodifyShard,
  qTokens: string[],
  out: CodifyResult[],
  limit: number,
  collapse = false,
  opts?: SearchOptions
) {
  const { scoreBuf, maskBuf, aliasBuf, fuzzyBuf } = s;
  const N = s.docCount;
  const fullMask = (1 << qTokens.length) - 1;
  let touchedCount = 0;
  let firstLo = 0;
  let firstHi = 0;
  const typedLen = qTokens.reduce((n, t) => n + t.length, 0);
  const idfDamp = Math.min(1, typedLen / 4);

  const bail = () => {
    for (let i = 0; i < touchedCount; i++) {
      const d = s.touched[i];
      maskBuf[d] = 0;
      scoreBuf[d] = 0;
      aliasBuf[d] = 0;
      fuzzyBuf[d] = 0;
    }
  };

  for (let qi = 0; qi < qTokens.length; qi++) {
    const q = qTokens[qi];
    const bit = 1 << qi;
    const [lo, hi] = prefixRange(s, q);
    if (qi === 0) {
      firstLo = lo;
      firstHi = hi;
    }
    let penalty = 1;
    let expansions: number[] | null = null;
    if (lo >= hi && q.length >= 3) {
      expansions = fuzzyCandidates(s, q, 8);
      penalty = 0.6;
      if (expansions.length === 0) return bail();
    } else if (lo >= hi) {
      return bail();
    } else if (hi - lo > MAX_EXPANSIONS && s.tokenPrior) {
      expansions = topPriorTokens(s, lo, hi, MAX_EXPANSIONS);
    }

    const count = expansions
      ? expansions.length
      : Math.min(hi - lo, MAX_EXPANSIONS);
    for (let e = 0; e < count; e++) {
      const t = expansions ? expansions[e] : lo + e;
      const df = s.postStart[t + 1] - s.postStart[t];
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const idfEff = 1 + idfDamp * (idf - 1);
      const tLen = s.tokenOffsets[t + 1] - s.tokenOffsets[t];
      const completeness = q.length / tLen;
      const w = idfEff * (0.5 + 0.5 * Math.min(1, completeness)) * penalty;
      const start = s.postStart[t];
      const end = s.postStart[t + 1];
      for (let p = start; p < end; p++) {
        const v = s.postings[p];
        const d = v >>> 1;
        const alias = v & 1;
        if (maskBuf[d] & bit) continue;
        if (qi > 0 && maskBuf[d] === 0) continue;
        if (maskBuf[d] === 0) s.touched[touchedCount++] = d;
        maskBuf[d] |= bit;
        scoreBuf[d] += alias ? w * 0.85 : w;
        if (alias) aliasBuf[d] = 1;
        if (penalty < 1) fuzzyBuf[d] = 1;
      }
    }
  }

  const priorWeight = PRIOR_WEIGHT + SHORT_PRIOR_WEIGHT / typedLen;
  const firstTok = s.docFirstTok;
  const fams = collapse
    ? new Map<
        string,
        { best: number; d: number; len: number; alias: boolean; fuzzy: boolean }
      >()
    : null;
  const billable =
    opts?.billableOnly && s.domain === 'condition' ? billableMask(s) : null;
  let boostIdx: Set<number> | null = null;
  if (opts?.boostCodetypes) {
    const idx = opts.boostCodetypes
      .map((ct) => s.codetypes.indexOf(ct))
      .filter((i) => i >= 0);
    if (idx.length > 0) boostIdx = new Set(idx);
  }
  for (let i = 0; i < touchedCount; i++) {
    const d = s.touched[i];
    if (maskBuf[d] === fullMask && (!billable || billable[d] === 1)) {
      const lenNorm = 1 / (1 + 0.25 * Math.max(0, s.docLen[d] - 1));
      const prior = s.docPrior ? s.docPrior[d] / 255 : 0;
      const leading =
        firstTok && firstTok[d] >= firstLo && firstTok[d] < firstHi;
      const score =
        scoreBuf[d] *
        (0.6 + 0.4 * lenNorm) *
        (1 + priorWeight * prior) *
        (leading ? LEAD_BONUS : 1) *
        (boostIdx && boostIdx.has(s.docCodetype[d]) ? CODETYPE_BOOST : 1);
      const alias = aliasBuf[d] === 1;
      const fuzzy = fuzzyBuf[d] === 1;
      if (fams) {
        const labelLen = s.labelOffsets[d + 1] - s.labelOffsets[d];
        const label = td.decode(
          s.labelBlob.subarray(
            s.labelOffsets[d],
            Math.min(s.labelOffsets[d + 1], s.labelOffsets[d] + 64)
          )
        );
        const fullcode =
          s.domain === 'condition' ||
          s.domain === 'occupational' ||
          s.domain === 'quality'
            ? td.decode(
                s.codeBlob.subarray(s.codeOffsets[d], s.codeOffsets[d + 1])
              )
            : '';
        const key = familyKey(s.domain, label, fullcode);
        const fam = fams.get(key);
        if (!fam) {
          fams.set(key, { best: score, d, len: labelLen, alias, fuzzy });
        } else {
          if (score > fam.best) fam.best = score;
          if (labelLen < fam.len && score >= 0.6 * fam.best) {
            fam.d = d;
            fam.len = labelLen;
            fam.alias = alias;
            fam.fuzzy = fuzzy;
          }
        }
      } else {
        pushResult(out, s, d, score, alias, fuzzy, limit * 3);
      }
    }
    maskBuf[d] = 0;
    scoreBuf[d] = 0;
    aliasBuf[d] = 0;
    fuzzyBuf[d] = 0;
  }
  if (fams) {
    for (const fam of fams.values()) {
      pushResult(out, s, fam.d, fam.best, fam.alias, fam.fuzzy, limit * 3);
    }
  }
}

function pushResult(
  out: CodifyResult[],
  s: CodifyShard,
  d: number,
  score: number,
  viaAlias: boolean,
  viaFuzzy: boolean,
  cap: number,
  viaCode = false
) {
  if (out.length >= cap) {
    let minI = 0;
    for (let i = 1; i < out.length; i++) {
      if (out[i].score < out[minI].score) minI = i;
    }
    if (out[minI].score >= score) return;
    out.splice(minI, 1);
  }
  out.push({
    fullid: td.decode(
      s.fullidBlob.subarray(s.fullidOffsets[d], s.fullidOffsets[d + 1])
    ),
    label: td.decode(
      s.labelBlob.subarray(s.labelOffsets[d], s.labelOffsets[d + 1])
    ),
    codetype: s.codetypes[s.docCodetype[d]],
    fullcode: td.decode(
      s.codeBlob.subarray(s.codeOffsets[d], s.codeOffsets[d + 1])
    ),
    domain: s.domain,
    score,
    viaAlias,
    viaFuzzy,
    viaCode,
  });
}
