import type {
  DocumentListDocument,
  DocumentListInput,
  DocumentListValue,
} from './types.js';

/** Content type of composed and inline markdown documents. */
export const DOCUMENT_LIST_MARKDOWN_TYPE = 'text/x-markdown';

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
  width: 48,
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

export function normalizeDocumentRow(
  value: unknown
): DocumentListDocument | null {
  const input = asInput(value);
  const id = input ? stringId(input.id) : null;
  if (!input || !id) return null;

  return {
    id,
    date: displayValue(input.date),
    title: displayValue(input.title),
    subject: displayValue(input.subject),
    docType: displayValue(input.docType),
    docId: displayValue(input.docId),
    source: displayValue(input.source ?? input.from ?? input.author),
    file: fileValue(input.file),
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

export function createLocalSourcePayload(
  rows: readonly DocumentListDocument[]
): {
  data: DocumentListDocument[];
  typeInfo: typeof DOCUMENT_LIST_TYPE_INFO;
} {
  return {
    data: rows.map((row) => ({ ...row })),
    typeInfo: DOCUMENT_LIST_TYPE_INFO,
  };
}
