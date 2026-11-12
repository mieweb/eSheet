/**
 * ED.46 — the storage seam: three backends, one port.
 *
 * Everything Phase 7 calls a save goes through `save()`; the `action` is what
 * tells a backend how to treat it. Which store a field uses is the field's
 * existing declaration (`inline: true` / the host's directories), not a new
 * setting. The **inline** store keeps a document — head, prose and history —
 * on its row inside the case answer; the **file** store keeps bytes behind a
 * `DocumentListRepository` (eCase's content-addressed blob store today);
 * WebChart's adapter lives server-side (eCase `ED.48`) and implements this
 * same shape structurally. None of the three leaks into the field.
 */
import { createDocumentId, priorRevisionOf, today } from './data.js';
import type { DocumentListContent } from './document-list-runtime.js';
import type {
  DocumentListAuthor,
  DocumentListDocument,
  DocumentRevision,
  DocumentRevisionAction,
} from './types.js';

/** One save, of any kind — the action is what a backend dispatches on. */
export interface DocumentSave {
  readonly action: DocumentRevisionAction;
  readonly contentType?: string;
  /** The document's bytes; absent for remove/restore, empty for blank. */
  readonly bytes?: string;
  /** Projected display fields the row carries (title, subject, docType…). */
  readonly columns?: Readonly<Record<string, string>>;
  readonly author?: DocumentListAuthor;
  /** ISO 8601; the store's clock when absent. */
  readonly at?: string;
  /** Everyone who contributed to the draft since the last save (PM.7). */
  readonly contributors?: readonly DocumentListAuthor[];
}
export interface DocumentStore {
  /** Head revisions only; tombstoned rows included (the UI filters). */
  list(): Promise<readonly DocumentListDocument[]>;
  /** Content of one revision; omit `rev` for the head. */
  read(id: string, rev?: number): Promise<DocumentListContent>;
  /** `id: null` creates; otherwise the save becomes the next head revision. */
  save(id: string | null, save: DocumentSave): Promise<DocumentListDocument>;
  listRevisions(id: string): Promise<readonly DocumentRevision[]>;
  /** Row-to-row reference (linked addendum); the target stays byte-identical. */
  link(
    id: string,
    toId: string,
    linkType: string,
    comment?: string
  ): Promise<void>;
  /** Tombstone with a required reason. Content retention is backend policy. */
  remove(
    id: string,
    reason: string,
    author?: DocumentListAuthor
  ): Promise<DocumentListDocument>;
  restore(
    id: string,
    author?: DocumentListAuthor
  ): Promise<DocumentListDocument>;
  /**
   * ED.49 — the projected column keys this backend can store; anything else
   * survives only inside the document text. Hosts warn at config-check time
   * instead of silently dropping data.
   */
  readonly acceptedColumns: readonly string[];
}

/** Where the inline store's rows live — the case answer, host-bound. */
export interface DocumentRowRegistry {
  rows(): readonly DocumentListDocument[];
  write(rows: readonly DocumentListDocument[]): void;
}

/**
 * ED.49 — the columns a backend can store are *its* choice, not the form's.
 * Returns the declared column keys the store cannot carry, so a host can
 * warn at config-check time instead of silently dropping data (everything
 * else round-trips losslessly inside the document text).
 */
export function unsupportedColumns(
  declared: readonly string[] | undefined,
  store: Pick<DocumentStore, 'acceptedColumns'>
): string[] {
  return (declared ?? []).filter(
    (column) => !store.acceptedColumns.includes(column)
  );
}

const INLINE_COLUMNS = ['title', 'subject', 'docType', 'date'] as const;

function findRow(
  registry: DocumentRowRegistry,
  id: string
): DocumentListDocument {
  const row = registry.rows().find((candidate) => candidate.id === id);
  if (!row) throw new Error(`no document '${id}'`);
  return row;
}

function replaceRow(
  registry: DocumentRowRegistry,
  next: DocumentListDocument
): void {
  registry.write(
    registry.rows().map((row) => (row.id === next.id ? next : row))
  );
}

function withColumns(
  row: DocumentListDocument,
  columns: Readonly<Record<string, string>> | undefined
): DocumentListDocument {
  if (!columns) return row;
  const applied: Record<string, unknown> = { ...row };
  for (const key of INLINE_COLUMNS) {
    if (columns[key] !== undefined) applied[key] = columns[key];
  }
  return applied as unknown as DocumentListDocument;
}

/**
 * ED.47 — the inline store: a case note's whole life lives on its row. Saves
 * append the superseded head to `history[]`, prose in full — a truncated
 * history is a worse thing to own than a slightly larger case doc — so the
 * history merges, syncs and travels with the case like every other answer.
 */
export function createInlineDocumentStore(
  registry: DocumentRowRegistry
): DocumentStore {
  const nextHead = (
    prior: DocumentListDocument,
    save: DocumentSave,
    body?: string
  ): DocumentListDocument =>
    withColumns(
      {
        ...prior,
        date: today(save.at),
        ...(save.author ? { author: save.author } : {}),
        rev: (prior.rev ?? 0) + 1,
        action: save.action,
        ...(body !== undefined ? { body } : {}),
        history: [...(prior.history ?? []), priorRevisionOf(prior)],
      },
      save.columns
    );

  return {
    acceptedColumns: [...INLINE_COLUMNS],

    list: async () => registry.rows(),

    read: async (id, rev) => {
      const row = findRow(registry, id);
      if (rev === undefined || rev === (row.rev ?? 0)) {
        return { text: row.body ?? '', contentType: 'text/x-markdown' };
      }
      const revision = row.history?.find((entry) => entry.rev === rev);
      if (!revision) throw new Error(`no revision ${rev} of '${id}'`);
      return { text: revision.body ?? '', contentType: 'text/x-markdown' };
    },

    save: async (id, save) => {
      if (id === null) {
        const documentId = createDocumentId();
        const row = withColumns(
          {
            id: documentId,
            date: today(save.at),
            title: '—',
            subject: '—',
            docType: '—',
            docId: documentId,
            source: 'Compose',
            file: `${documentId}.md`,
            ...(save.author ? { author: save.author } : {}),
            action: 'create',
            body: save.bytes ?? '',
          },
          save.columns
        );
        registry.write([...registry.rows(), row]);
        return row;
      }
      const next = nextHead(findRow(registry, id), save, save.bytes ?? '');
      replaceRow(registry, next);
      return next;
    },

    listRevisions: async (id) => {
      const row = findRow(registry, id);
      return [...(row.history ?? []), priorRevisionOf(row)].reverse();
    },

    link: async (id, toId, linkType, comment) => {
      findRow(registry, toId); // the target must exist
      const row = findRow(registry, id);
      replaceRow(registry, {
        ...row,
        linkedTo: { id: toId, linkType, ...(comment ? { comment } : {}) },
      });
    },

    remove: async (id, reason, author) => {
      if (!reason.trim()) throw new Error('removal requires a reason');
      const prior = findRow(registry, id);
      const next = {
        ...nextHead(prior, { action: 'remove', author }),
        removed: {
          ...(author ? { author } : {}),
          at: new Date().toISOString(),
          reason,
        },
      };
      replaceRow(registry, next);
      return next;
    },

    restore: async (id, author) => {
      const prior = findRow(registry, id);
      const { removed: _removed, ...rest } = nextHead(prior, {
        action: 'restore',
        author,
      });
      void _removed;
      replaceRow(registry, rest);
      return rest;
    },
  };
}
