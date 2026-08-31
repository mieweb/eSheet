import type {
  DocumentListAuthor,
  DocumentListDocument,
  DocumentListInput,
  DocumentListLink,
  DocumentListRemoval,
  DocumentListValue,
  DocumentRevision,
  DocumentRevisionAction,
} from './types.js';
import type { FileReference } from '@esheet/core';
import { DOCUMENT_REVISION_ACTIONS } from './types.js';

/** Content type of composed and inline markdown documents. */
export const DOCUMENT_LIST_MARKDOWN_TYPE = 'text/x-markdown';

/** Content type of MDY documents — front matter + markdown body (ED.45). */
export const DOCUMENT_LIST_MDY_TYPE = 'text/x-mdy';

export function createDocumentId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `document-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function today(at?: string): string {
  return (at ?? new Date().toISOString()).slice(0, 10);
}

/**
 * The serialization a doc type's saves use: its explicit choice, else what it
 * carries — a definition has answers for front matter, a plain type does not.
 */
export function docTypeSerialization(
  option:
    | { readonly serialization?: 'text' | 'mdy'; readonly definition?: unknown }
    | undefined
): 'text' | 'mdy' {
  return option?.serialization ?? (option?.definition ? 'mdy' : 'text');
}

/** What one row is called when a field names nothing else. */
export const DOCUMENT_LIST_DEFAULT_NOUN = 'document';

export const DOCUMENT_LIST_COLUMNS = [
  {
    field: 'date',
    header: 'Date',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'title',
    header: 'Title',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'subject',
    header: 'Subject',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'docType',
    header: 'Document Type',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 150,
  },
  {
    field: 'docId',
    header: 'Doc ID',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 90,
  },
  {
    field: 'rev',
    header: 'Rev',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 56,
  },
  {
    field: 'source',
    header: 'Source',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'file',
    header: 'File',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 120,
  },
] as const;

export const DOCUMENT_LIST_ACTIONS_COLUMN = {
  field: '_actions',
  header: 'Actions',
  sortable: false,
  filterable: false,
  resizable: false,
  // No fixed width: the buttons render inline and size the cell.
} as const;

export const DOCUMENT_LIST_TYPE_INFO = DOCUMENT_LIST_COLUMNS.map((column) => ({
  field: column.field,
  displayText: column.header,
  type: 'string',
}));

const EMPTY_DISPLAY = '—';

function displayValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return EMPTY_DISPLAY;
}

function fileValue(value: unknown): string {
  const display = displayValue(value);
  return display === EMPTY_DISPLAY ? 'browser' : display;
}

function stringId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asInput(value: unknown): DocumentListInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as DocumentListInput;
}

/** A structured `{ id, name }` author; legacy string authors fold into `source`. */
function authorValue(value: unknown): DocumentListAuthor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, name } = value as { id?: unknown; name?: unknown };
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name)
    return null;
  return { id, name };
}

/** A head revision number: a non-negative integer, or nothing (meaning 0). */
function revValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

/** A tombstone — only the reason is load-bearing; provenance is optional. */
function removedValue(value: unknown): DocumentListRemoval | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { author, at, reason } = value as {
    author?: unknown;
    at?: unknown;
    reason?: unknown;
  };
  if (typeof reason !== 'string' || !reason.trim()) return null;
  const parsedAuthor = authorValue(author);
  return {
    reason,
    ...(parsedAuthor ? { author: parsedAuthor } : {}),
    ...(typeof at === 'string' && at ? { at } : {}),
  };
}

function isRevisionAction(value: unknown): value is DocumentRevisionAction {
  return (DOCUMENT_REVISION_ACTIONS as readonly unknown[]).includes(value);
}

/** A row-to-row link; a link without a target is no link. */
function linkValue(value: unknown): DocumentListLink | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, linkType, comment } = value as {
    id?: unknown;
    linkType?: unknown;
    comment?: unknown;
  };
  if (typeof id !== 'string' || !id) return null;
  return {
    id,
    linkType: typeof linkType === 'string' && linkType ? linkType : 'addendum',
    ...(typeof comment === 'string' && comment ? { comment } : {}),
  };
}

function revisionValue(value: unknown): DocumentRevision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const rev = revValue(raw.rev);
  if (rev === null || !isRevisionAction(raw.action)) return null;
  const author = authorValue(raw.author);
  const contributors = Array.isArray(raw.contributors)
    ? raw.contributors.flatMap((entry) => authorValue(entry) ?? [])
    : null;
  return {
    rev,
    action: raw.action,
    ...(author ? { author } : {}),
    ...(contributors && contributors.length > 0 ? { contributors } : {}),
    ...(typeof raw.at === 'string' && raw.at ? { at: raw.at } : {}),
    ...(typeof raw.contentType === 'string' && raw.contentType
      ? { contentType: raw.contentType }
      : {}),
    ...(typeof raw.size === 'number' && Number.isFinite(raw.size)
      ? { size: raw.size }
      : {}),
    ...(typeof raw.body === 'string' ? { body: raw.body } : {}),
  };
}

/** Prior revisions of an inline row; malformed entries are dropped, not fatal. */
function historyValue(value: unknown): DocumentRevision[] | null {
  if (!Array.isArray(value)) return null;
  const revisions = value.flatMap((entry) => revisionValue(entry) ?? []);
  return revisions.length > 0 ? revisions : null;
}

function fileReferenceValue(value: unknown): FileReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const reference = value as Record<string, unknown>;
  if (typeof reference.id !== 'string' || !reference.id) return null;
  if (typeof reference.contentType !== 'string' || !reference.contentType)
    return null;
  return { ...reference, id: reference.id, contentType: reference.contentType };
}

export function normalizeDocumentRow(
  value: unknown
): DocumentListDocument | null {
  const input = asInput(value);
  const id = input ? stringId(input.id) : null;
  if (!input || !id) return null;

  const author = authorValue(input.author);
  const rev = revValue(input.rev);
  const action = isRevisionAction(input.action) ? input.action : null;
  const linkedTo = linkValue(input.linkedTo);
  const removed = removedValue(input.removed);
  const history = historyValue(input.history);
  const fileReference = fileReferenceValue(input.fileReference);
  return {
    id,
    date: displayValue(input.date),
    title: displayValue(input.title),
    subject: displayValue(input.subject),
    docType: displayValue(input.docType),
    docId: displayValue(input.docId),
    source: displayValue(
      input.source ?? input.from ?? (author ? undefined : input.author)
    ),
    file: fileValue(input.file),
    ...(author ? { author } : {}),
    ...(rev !== null ? { rev } : {}),
    ...(action ? { action } : {}),
    ...(linkedTo ? { linkedTo } : {}),
    ...(removed ? { removed } : {}),
    ...(history ? { history } : {}),
    ...(fileReference ? { fileReference } : {}),
    // Host bookkeeping: carried through untouched, absent when not recorded.
    ...(typeof input.sha256 === 'string' && input.sha256
      ? { sha256: input.sha256 }
      : {}),
    ...(typeof input.size === 'number' && Number.isFinite(input.size)
      ? { size: input.size }
      : {}),
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
  };
}

export function normalizeDocumentRows(value: unknown): DocumentListDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const normalized = normalizeDocumentRow(row);
    return normalized ? [normalized] : [];
  });
}

export function parseDocumentListAnswer(
  answer: string | undefined
): DocumentListDocument[] {
  if (!answer) return [];

  try {
    const parsed: unknown = JSON.parse(answer);
    if (Array.isArray(parsed)) return normalizeDocumentRows(parsed);
    if (!parsed || typeof parsed !== 'object') return [];

    const value = parsed as Partial<DocumentListValue> & {
      rows?: unknown;
    };
    return normalizeDocumentRows(value.documents ?? value.rows);
  } catch {
    return [];
  }
}

export function documentListValueFromRows(
  rows: readonly DocumentListDocument[]
): DocumentListValue {
  return { documents: rows };
}

/**
 * The head of a row as a history entry, for the moment it is superseded —
 * the recorded action wins; only rows from before actions were recorded
 * derive one. Inline rows keep their prose in full.
 */
export function priorRevisionOf(row: DocumentListDocument): DocumentRevision {
  return {
    rev: row.rev ?? 0,
    action: row.action ?? ((row.rev ?? 0) === 0 ? 'create' : 'edit'),
    ...(row.author ? { author: row.author } : {}),
    at: row.date,
    ...(row.body != null ? { body: row.body } : {}),
  };
}

export function createLocalSourcePayload(
  rows: readonly DocumentListDocument[]
): {
  data: DocumentListDocument[];
  typeInfo: typeof DOCUMENT_LIST_TYPE_INFO;
} {
  return {
    // `rev` displays as a column, so absent (a pre-revision row) reads as 0.
    data: rows.map((row) => ({ ...row, rev: row.rev ?? 0 })),
    typeInfo: DOCUMENT_LIST_TYPE_INFO,
  };
}
