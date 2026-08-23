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

  it('publishes a fresh DataVis payload without mutating rows', () => {
    const rows = normalizeDocumentRows([{ id: 'doc-1', title: 'Letter' }]);
    const payload = createLocalSourcePayload(rows);

    expect(payload.data).toEqual(rows);
    expect(payload.data).not.toBe(rows);
    expect(
      payload.typeInfo.map((entry: { field: string }) => entry.field)
    ).toEqual([
      'date',
      'title',
      'subject',
      'docType',
      'docId',
      'source',
      'file',
    ]);
  });
});
