import { describe, expect, it } from 'vitest';
import {
  createFileDocumentStore,
  createInlineDocumentStore,
  unsupportedColumns,
  type DocumentRowRegistry,
} from './documentStore.js';
import { runDocumentStoreConformance } from './documentStoreConformance.js';
import type {
  DocumentListContent,
  DocumentListRepository,
} from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

function memoryRegistry(): DocumentRowRegistry {
  let rows: readonly DocumentListDocument[] = [];
  return {
    rows: () => rows,
    write: (next) => {
      rows = next;
    },
  };
}

/**
 * A memory stand-in for eCase's blob repository: content by id, every
 * revision retained forever — the blob store's documented policy.
 */
function memoryRepository(): DocumentListRepository {
  const bytes = new Map<string, DocumentListContent>();
  return {
    load: async () => ({ documents: [] }),
    save: async (_context, document, _signal, content) => {
      if (content) {
        bytes.set(document.id, {
          text: typeof content.content === 'string' ? content.content : '',
          contentType: content.contentType,
        });
      }
      return document;
    },
    remove: async () => undefined,
    loadContent: async (_context, document) => {
      const content = bytes.get(document.id);
      if (!content) throw new Error(`no content for '${document.id}'`);
      return content;
    },
  };
}

describe('DocumentStore conformance (ED.46/ED.47/ED.50)', () => {
  it('the inline store keeps a document’s whole life on its row', async () => {
    const registry = memoryRegistry();
    await runDocumentStoreConformance(createInlineDocumentStore(registry), {
      retainsContentAfterRemove: true,
      priorContentAddressable: true,
    });
    // ED.47 — superseded prose is kept in full, on the row, in the answer.
    const row = registry.rows()[0];
    expect(row.history?.map((entry) => entry.body)).toEqual([
      'first prose',
      'second prose',
      '',
      'appended prose',
      'appended prose',
    ]);
  });

  it('the file store keeps rows in the answer and bytes in the repository', async () => {
    const registry = memoryRegistry();
    const store = createFileDocumentStore({
      registry,
      repository: memoryRepository(),
      context: { formInstanceId: 'conformance', fieldId: 'letterLog' },
    });
    await runDocumentStoreConformance(store, {
      retainsContentAfterRemove: true,
      // The row names only the head; prior bytes are the backend's business.
      priorContentAddressable: false,
    });
    // Metadata history rides the row; the prose stays behind the repository.
    const row = registry.rows()[0];
    expect(row.history?.every((entry) => entry.body === undefined)).toBe(true);
    expect(row.history).toHaveLength(5);
  });
});

describe('unsupportedColumns (ED.49)', () => {
  it('names the declared columns a backend cannot carry', () => {
    const webchartLike = { acceptedColumns: ['title', 'docType', 'date'] };
    expect(unsupportedColumns(['date', 'title', 'subject', 'file'], webchartLike)).toEqual(
      ['subject', 'file']
    );
    expect(unsupportedColumns(undefined, webchartLike)).toEqual([]);
    expect(
      unsupportedColumns(['title'], createInlineDocumentStore({ rows: () => [], write: () => {} }))
    ).toEqual([]);
  });
});
