/**
 * MDY — the frontmatter contract for composed documents.
 *
 * A composed document is one file: a YAML front-matter block that holds the
 * structured answers, and a markdown body that holds the prose. This module is
 * the only place that knows how the two are joined, and it enforces the two
 * rules the composer depends on:
 *
 * - **Strip before the editor.** Kerebron is given `body` and nothing else, so
 *   a writer never sees — and can never corrupt — the YAML.
 * - **Re-attach on save.** The block the file arrived with is kept verbatim and
 *   put back, so a save that only touched prose leaves the data byte-identical.
 *   That is MDY conformance rule 3: round-trip losslessly, and preserve
 *   comments, key order and quoting rather than load → dump.
 *
 * The format is the MDY specification (templit `doc/mdy-specification.md`), not
 * an invention of this package. A document with no front matter is not an
 * error — it is the note tier, and parses to `frontMatter: null`.
 */
import { dump, load } from 'js-yaml';

/**
 * The front-matter keys this field gives meaning to. Everything else is carried
 * through untouched: MDY front matter is an open YAML mapping, and a host may
 * put `mdy:` provenance or its own keys beside these.
 */
export interface MdyFrontMatter {
  /** The document type, matching a `docTypes` entry's `id`. */
  readonly docType?: string;
  /** Which FormDefinition produced the answers, by id. */
  readonly definition?: string;
  /** That definition's version, so an old document keeps rendering. */
  readonly definitionVersion?: string;
  /** eSheet `FormResponse` — field id → `{ answer }` / `{ selected }`. */
  readonly response?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface MdyFile {
  /**
   * The parsed mapping, or `null` when the file has no front matter or its
   * YAML is unusable. Never throws: an unreadable block still round-trips.
   */
  readonly frontMatter: MdyFrontMatter | null;
  /**
   * The block verbatim, delimiters and line endings included; `''` when there
   * is none. This is what makes the round-trip lossless.
   */
  readonly frontMatterSource: string;
  /** The markdown the editor is given. */
  readonly body: string;
}

/** A front-matter block opens with `---` on the very first line. */
const OPENING_FENCE = /^---[ \t]*\r?\n/;
/** ...and closes with a line that is exactly `---`, possibly the next one. */
const CLOSING_FENCE = /(^|\r?\n)---[ \t]*(\r?\n|$)/;

function asMapping(value: unknown): MdyFrontMatter | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as MdyFrontMatter;
}

/**
 * Split a document into its front matter and its body. Any string is valid
 * input; text that is not MDY is simply all body.
 */
export function parseMdy(text: string): MdyFile {
  const opening = OPENING_FENCE.exec(text);
  if (!opening) return { frontMatter: null, frontMatterSource: '', body: text };

  const afterOpening = text.slice(opening[0].length);
  const closing = CLOSING_FENCE.exec(afterOpening);
  // An unterminated block is not front matter — it is a body that happens to
  // start with a rule.
  if (!closing) return { frontMatter: null, frontMatterSource: '', body: text };

  const yamlSource = afterOpening.slice(0, closing.index + closing[1].length);
  const blockLength = opening[0].length + closing.index + closing[0].length;

  let frontMatter: MdyFrontMatter | null = null;
  try {
    // `load` uses the default schema, which instantiates no custom types —
    // MDY security rule: safe YAML only.
    frontMatter = asMapping(load(yamlSource));
  } catch {
    // Unparseable YAML means "note tier", never a broken document.
    frontMatter = null;
  }

  return {
    frontMatter,
    frontMatterSource: text.slice(0, blockLength),
    body: text.slice(blockLength),
  };
}

/** Join a file back into one document. `serializeMdy(parseMdy(t)) === t`. */
export function serializeMdy(file: MdyFile): string {
  return `${file.frontMatterSource}${file.body}`;
}

/** The markdown to hand an editor — front matter never reaches it. */
export function mdyBody(text: string): string {
  return parseMdy(text).body;
}

/**
 * Put an edited body back under the front matter it came with. This is the
 * save path: the block is the original bytes, so nothing but the prose moves.
 */
export function withMdyBody(file: MdyFile, body: string): MdyFile {
  return { ...file, body };
}

/**
 * Replace the data. Only call this when the answers actually changed — it
 * re-emits the YAML, which costs the original comments, key order and quoting.
 * An empty mapping drops the block entirely, back to the note tier.
 */
export function withMdyFrontMatter(
  file: MdyFile,
  frontMatter: MdyFrontMatter | null
): MdyFile {
  if (!frontMatter || Object.keys(frontMatter).length === 0) {
    return { frontMatter: null, frontMatterSource: '', body: file.body };
  }
  const yamlSource = dump(frontMatter, { noRefs: true, lineWidth: -1 });
  return {
    frontMatter,
    frontMatterSource: `---\n${yamlSource}---\n`,
    body: file.body,
  };
}
