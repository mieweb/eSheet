// ---------------------------------------------------------------------------
// Notes helpers — mergeNotes / collectAttachments / mapAttachments tests
// ---------------------------------------------------------------------------

import { mergeNotes, collectAttachments, mapAttachments } from './notes.js';
import type { AttachmentAnswer, FieldResponse, NoteEntry } from '../types.js';

const note = (
  id: string,
  createdAt: string,
  overrides: Partial<NoteEntry> = {}
): NoteEntry => ({
  id,
  createdAt,
  markdown: `note ${id}`,
  ...overrides,
});

describe('mergeNotes', () => {
  it('unions concurrent adds from two clients (different GUIDs)', () => {
    const a = [note('a1', '2026-01-01T10:00:00Z')];
    const b = [note('b1', '2026-01-01T11:00:00Z')];
    const merged = mergeNotes(a, b);
    expect(merged.map((n) => n.id)).toEqual(['a1', 'b1']);
  });

  it('resolves same-id edit conflicts last-writer-wins on updatedAt', () => {
    const older = note('n1', '2026-01-01T10:00:00Z', {
      markdown: 'older edit',
      updatedAt: '2026-01-02T10:00:00Z',
    });
    const newer = note('n1', '2026-01-01T10:00:00Z', {
      markdown: 'newer edit',
      updatedAt: '2026-01-03T10:00:00Z',
    });
    expect(mergeNotes([older], [newer])[0].markdown).toBe('newer edit');
    expect(mergeNotes([newer], [older])[0].markdown).toBe('newer edit');
  });

  it('falls back to createdAt when updatedAt is absent', () => {
    const unedited = note('n1', '2026-01-01T10:00:00Z');
    const edited = note('n1', '2026-01-01T10:00:00Z', {
      markdown: 'edited',
      updatedAt: '2026-01-01T12:00:00Z',
    });
    expect(mergeNotes([unedited], [edited])[0].markdown).toBe('edited');
    expect(mergeNotes([edited], [unedited])[0].markdown).toBe('edited');
  });

  it('sorts output by createdAt', () => {
    const merged = mergeNotes(
      [note('late', '2026-02-01T00:00:00Z')],
      [note('early', '2026-01-01T00:00:00Z')]
    );
    expect(merged.map((n) => n.id)).toEqual(['early', 'late']);
  });

  it('handles undefined sides', () => {
    const a = [note('a1', '2026-01-01T00:00:00Z')];
    expect(mergeNotes(a, undefined)).toEqual(a);
    expect(mergeNotes(undefined, a)).toEqual(a);
    expect(mergeNotes(undefined, undefined)).toEqual([]);
  });
});

describe('collectAttachments', () => {
  const att = (title: string): AttachmentAnswer => ({
    contentType: 'image/png',
    dataUrl: `data:${title}`,
    title,
  });

  it('collects single and multiple fileData', () => {
    expect(collectAttachments({ fileData: att('one') })).toHaveLength(1);
    expect(
      collectAttachments({ fileData: [att('one'), att('two')] })
    ).toHaveLength(2);
  });

  it('collects notes[].attachments', () => {
    const response: FieldResponse = {
      notes: [
        note('n1', '2026-01-01T00:00:00Z', { attachments: [att('a')] }),
        note('n2', '2026-01-02T00:00:00Z'),
        note('n3', '2026-01-03T00:00:00Z', {
          attachments: [att('b'), att('c')],
        }),
      ],
    };
    expect(collectAttachments(response).map((a) => a.title)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns empty for responses without attachments', () => {
    expect(collectAttachments({ answer: 'text' })).toEqual([]);
  });
});

describe('mapAttachments', () => {
  const externalize = (a: AttachmentAnswer): AttachmentAnswer => ({
    contentType: a.contentType,
    url: `case/attachments/${a.title}`,
    title: a.title,
  });

  it('rewrites fileData (single and array) preserving shape', () => {
    const single = mapAttachments(
      { fileData: { contentType: 'image/png', dataUrl: 'x', title: 'f1' } },
      externalize
    );
    expect(single.fileData).toMatchObject({ url: 'case/attachments/f1' });
    expect(Array.isArray(single.fileData)).toBe(false);

    const multi = mapAttachments(
      {
        fileData: [
          { contentType: 'image/png', dataUrl: 'x', title: 'f1' },
          { contentType: 'image/png', dataUrl: 'y', title: 'f2' },
        ],
      },
      externalize
    );
    expect((multi.fileData as AttachmentAnswer[]).map((a) => a.url)).toEqual([
      'case/attachments/f1',
      'case/attachments/f2',
    ]);
  });

  it('rewrites notes[].attachments without touching note bodies', () => {
    const response: FieldResponse = {
      notes: [
        note('n1', '2026-01-01T00:00:00Z', {
          attachments: [{ contentType: 'image/png', dataUrl: 'x', title: 'a' }],
        }),
        note('n2', '2026-01-02T00:00:00Z'),
      ],
    };
    const mapped = mapAttachments(response, externalize);
    expect(mapped.notes?.[0].attachments?.[0].url).toBe('case/attachments/a');
    expect(mapped.notes?.[0].markdown).toBe('note n1');
    expect(mapped.notes?.[1]).toBe(response.notes?.[1]);
  });

  it('returns the same reference when there is nothing to map', () => {
    const response: FieldResponse = { answer: 'plain text' };
    expect(mapAttachments(response, externalize)).toBe(response);
  });

  it('round-trips unchanged with an identity mapper', () => {
    const response: FieldResponse = {
      notes: [
        note('n1', '2026-01-01T00:00:00Z', {
          attachments: [{ contentType: 'image/png', dataUrl: 'x' }],
        }),
      ],
    };
    expect(mapAttachments(response, (a) => a)).toEqual(response);
  });
});
