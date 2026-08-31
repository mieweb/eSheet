import {
  createLocalSourcePayload,
  normalizeDocumentRows,
  parseDocumentListAnswer,
} from './data.js';

describe('document list data', () => {
  it('normalizes projected document summaries and display fallbacks', () => {
    expect(
      normalizeDocumentRows([
        {
          id: 'doc-1',
          date: '2026-08-18',
          title: 'Letter',
          subject: '',
          docType: null,
          docId: 42,
          from: 'WebChart',
          file: '42.pdf',
        },
        { title: 'Missing identity' },
        { id: 'doc-2', title: 'Browser draft' },
      ])
    ).toEqual([
      {
        id: 'doc-1',
        date: '2026-08-18',
        title: 'Letter',
        subject: '—',
        docType: '—',
        docId: '42',
        source: 'WebChart',
        file: '42.pdf',
      },
      {
        id: 'doc-2',
        date: '—',
        title: 'Browser draft',
        subject: '—',
        docType: '—',
        docId: '—',
        source: '—',
        file: 'browser',
      },
    ]);
  });

  it('accepts object, rows, and direct-array response shapes', () => {
    const row = { id: 'doc-1', title: 'Letter' };

    expect(
      parseDocumentListAnswer(JSON.stringify({ documents: [row] }))
    ).toHaveLength(1);
    expect(
      parseDocumentListAnswer(JSON.stringify({ rows: [row] }))
    ).toHaveLength(1);
    expect(parseDocumentListAnswer(JSON.stringify([row]))).toHaveLength(1);
    expect(parseDocumentListAnswer('{invalid')).toEqual([]);
  });

  it('preserves the file reference needed to load a preview', () => {
    const fileReference = {
      id: 'attachments/letter.md',
      contentType: 'text/markdown',
      title: 'letter.md',
      size: 12,
      sha256: 'abc123',
    };

    expect(
      parseDocumentListAnswer(
        JSON.stringify({ documents: [{ id: 'doc-1', fileReference }] })
      )[0].fileReference
    ).toEqual(fileReference);
  });

  it('round-trips a structured author and folds a legacy string one into source', () => {
    const [structured] = normalizeDocumentRows([
      { id: 'doc-1', title: 'Note', author: { id: 'u-1', name: 'Casey' } },
    ]);
    expect(structured.author).toEqual({ id: 'u-1', name: 'Casey' });
    expect(structured.source).toBe('—');

    const [legacy] = normalizeDocumentRows([
      { id: 'doc-2', title: 'Note', author: 'Casey Manager' },
    ]);
    expect(legacy.author).toBeUndefined();
    expect(legacy.source).toBe('Casey Manager');

    // Half-formed authors are dropped, never invented.
    const [broken] = normalizeDocumentRows([
      { id: 'doc-3', title: 'Note', author: { id: 'u-1' } },
    ]);
    expect(broken.author).toBeUndefined();
  });

  it('round-trips rev, removed and history; malformed provenance drops silently', () => {
    const casey = { id: 'u-1', name: 'Casey' };
    const [row] = normalizeDocumentRows([
      {
        id: 'doc-1',
        title: 'Note',
        rev: 2,
        removed: {
          author: casey,
          at: '2026-08-23T12:00:00Z',
          reason: 'wrong patient',
        },
        history: [
          {
            rev: 0,
            action: 'create',
            author: casey,
            at: '2026-08-01',
            body: 'v0',
          },
          { rev: 1, action: 'edit', contributors: [casey], size: 12 },
          { rev: 9, action: 'invent' }, // unknown action — dropped
          { action: 'edit' }, // no rev — dropped
        ],
      },
    ]);
    expect(row.rev).toBe(2);
    expect(row.removed).toEqual({
      author: casey,
      at: '2026-08-23T12:00:00Z',
      reason: 'wrong patient',
    });
    expect(row.history).toEqual([
      { rev: 0, action: 'create', author: casey, at: '2026-08-01', body: 'v0' },
      { rev: 1, action: 'edit', contributors: [casey], size: 12 },
    ]);

    // A rev may be 0 (the first save); anything else non-integer means absent.
    const [first] = normalizeDocumentRows([
      { id: 'doc-2', title: 'Note', rev: 0 },
    ]);
    expect(first.rev).toBe(0);
    const [none] = normalizeDocumentRows([
      { id: 'doc-3', title: 'Note', rev: -1 },
    ]);
    expect(none.rev).toBeUndefined();

    // A tombstone without a reason is not a tombstone.
    const [alive] = normalizeDocumentRows([
      { id: 'doc-4', title: 'Note', removed: { author: casey } },
    ]);
    expect(alive.removed).toBeUndefined();
  });

  it('publishes a fresh DataVis payload without mutating rows', () => {
    const rows = normalizeDocumentRows([{ id: 'doc-1', title: 'Letter' }]);
    const payload = createLocalSourcePayload(rows);

    // The payload defaults `rev` for display; the rows stay untouched.
    expect(payload.data).toEqual(rows.map((row) => ({ ...row, rev: 0 })));
    expect(rows[0].rev).toBeUndefined();
    expect(
      payload.typeInfo.map((entry: { field: string }) => entry.field)
    ).toEqual([
      'date',
      'title',
      'subject',
      'docType',
      'docId',
      'rev',
      'source',
      'file',
    ]);
  });
});
