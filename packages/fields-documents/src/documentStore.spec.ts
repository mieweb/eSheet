import { describe, expect, it } from 'vitest';
import {
  createInlineDocumentStore,
  unsupportedColumns,
  type DocumentRowRegistry,
} from './documentStore.js';
import { runDocumentStoreConformance } from './documentStoreConformance.js';
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
});

describe('unsupportedColumns (ED.49)', () => {
  it('names the declared columns a backend cannot carry', () => {
    const webchartLike = { acceptedColumns: ['title', 'docType', 'date'] };
    expect(
      unsupportedColumns(['date', 'title', 'subject', 'file'], webchartLike)
    ).toEqual(['subject', 'file']);
    expect(unsupportedColumns(undefined, webchartLike)).toEqual([]);
    expect(
      unsupportedColumns(
        ['title'],
        createInlineDocumentStore({ rows: () => [], write: () => {} })
      )
    ).toEqual([]);
  });
});
