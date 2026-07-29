import {
  normalizeResponses,
  type FieldResponseMap,
  type FormState,
  type RichTextAnswer,
} from '@esheet/core';

export type { RichTextAnswer };

/** Meta entry shape stored under each frontmatter field id. */
export type RichTextFrontmatterEntry = { value: unknown; display?: string };

/** eSheet field id segment: letters/underscore/hyphen, with optional dotted path. */
export const ESHEET_FIELD_ID_RE =
  /^[a-zA-Z_][a-zA-Z0-9_-]*(?:\.[a-zA-Z_][a-zA-Z0-9_-]*)*$/;

export function toMetaEntry(raw: unknown): RichTextFrontmatterEntry {
  // single selection { id, value }
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'id' in raw &&
    'value' in raw
  ) {
    const opt = raw as { id: string; value: string };
    return { value: opt.value, display: opt.value };
  }

  // multi selection
  if (
    Array.isArray(raw) &&
    raw.every((x) => x && typeof x === 'object' && 'value' in x)
  ) {
    const labels = (raw as { value: string }[]).map((x) => String(x.value));
    return { value: labels, display: labels.join(', ') };
  }

  return { value: raw };
}

/** Strip leading YAML frontmatter block so stored answers stay body-only. */
export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---\n')) return markdown;
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return markdown;
  let body = markdown.slice(end + 5);
  // Drop the conventional blank line after the closing fence.
  if (body.startsWith('\n')) body = body.slice(1);
  return body;
}

export function isRichTextAnswer(raw: unknown): raw is RichTextAnswer {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj['body'] === 'string' &&
    obj['frontmatter'] !== null &&
    typeof obj['frontmatter'] === 'object' &&
    !Array.isArray(obj['frontmatter'])
  );
}

/** Body markdown from a stored answer (structured, legacy string, or empty). */
export function getRichTextBody(
  answer: unknown,
  fallback = '',
): string {
  if (isRichTextAnswer(answer)) return answer.body;
  if (typeof answer === 'string') return stripFrontmatter(answer);
  return fallback;
}

/**
 * Build the structured richtext response payload.
 * Front matter is generated from live eSheet responses; body is markdown only.
 */
export function buildRichTextAnswer(
  body: string,
  frontmatter: Record<string, RichTextFrontmatterEntry>,
): RichTextAnswer {
  return { frontmatter, body };
}

/**
 * Rewrite markdown eSheet field links after a field-id rename.
 * `[label](#old-id)` → `[label](#new-id)`
 * `[label](#old-id.child)` → `[label](#new-id.child)`
 */
export function rewriteEsheetMarkdownRefs(
  markdown: string,
  oldId: string,
  newId: string,
): string {
  if (!markdown || oldId === newId) return markdown;
  const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\[[^\\]]*\\]\\(#)${escaped}(?=\\)|\\.)`, 'g');
  return markdown.replace(pattern, `$1${newId}`);
}

/**
 * Rewrite field ids inside a structured richtext answer (body links +
 * frontmatter keys) after a referenced field is renamed.
 */
export function rewriteRichTextAnswerRefs(
  answer: RichTextAnswer,
  oldId: string,
  newId: string,
): RichTextAnswer {
  const body = rewriteEsheetMarkdownRefs(answer.body, oldId, newId);
  const frontmatter: Record<string, RichTextFrontmatterEntry> = {};
  for (const [key, entry] of Object.entries(answer.frontmatter)) {
    const nextKey = key === oldId ? newId : key;
    frontmatter[nextKey] = entry;
  }
  return { frontmatter, body };
}

type FormStateSlice = Pick<FormState, 'responses' | 'getField'>;

/**
 * Build .mdy-style answer frontmatter from eSheet responses.
 * Skip every richtext field so one richtext answer never nests into
 * another richtext field’s generated front matter (self or peer).
 */
export function answersToFrontmatterMeta(
  formState: FormStateSlice,
  omitFieldId: string,
): Record<string, RichTextFrontmatterEntry> {
  const responses: FieldResponseMap = formState.responses;
  const flat = normalizeResponses(responses);
  const meta: Record<string, RichTextFrontmatterEntry> = {};
  for (const [fieldId, raw] of Object.entries(flat)) {
    if (fieldId === omitFieldId) continue;
    const field = formState.getField(fieldId);
    if (field?.definition.fieldType === 'richtext') continue;
    // Never nest a structured richtext document if type lookup missed.
    if (isRichTextAnswer(raw)) continue;
    meta[fieldId] = toMetaEntry(raw);
  }
  return meta;
}
