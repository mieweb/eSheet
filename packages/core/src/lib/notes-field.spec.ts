// ---------------------------------------------------------------------------
// Notes field — schema, registry, validation, and response extraction tests
// ---------------------------------------------------------------------------

import {
  formDefinitionSchema,
  normalizeFormDefinition,
  noteEntrySchema,
  type FormDefinition,
  type NoteEntry,
} from './types.js';
import { getFieldTypeMeta } from './registry.js';
import { normalizeDefinition } from './functions/normalize.js';
import { hydrateResponse } from './functions/hydrate-response.js';
import { extractResponseValue } from './functions/normalize-responses.js';
import { validateField } from './logic/validate.js';

const makeNote = (overrides: Partial<NoteEntry> = {}): NoteEntry => ({
  id: crypto.randomUUID(),
  createdAt: '2026-01-01T00:00:00.000Z',
  markdown: 'Hello *world*',
  ...overrides,
});

const notesForm: FormDefinition = {
  id: 'notes-form',
  pages: [
    {
      id: 'p1',
      fields: [
        {
          id: 'case-notes',
          fieldType: 'notes',
          question: 'Case notes',
          allowAttachments: true,
          accept: 'image/*,.pdf',
          maxFileSize: 1024,
          maxAttachments: 3,
          maxNotes: 10,
          sortOrder: 'oldest',
          entryLabel: 'Letter',
          required: true,
        },
      ],
    },
  ],
};

describe('notes field definition schema', () => {
  it('round-trips a notes field through the form schema', () => {
    const result = formDefinitionSchema.safeParse(notesForm);
    expect(result.success).toBe(true);
    if (result.success) {
      const field = result.data.pages[0].fields?.[0];
      expect(field).toMatchObject({
        fieldType: 'notes',
        entryLabel: 'Letter',
        sortOrder: 'oldest',
        allowAttachments: true,
      });
    }
  });

  it('rejects unknown properties on a notes field', () => {
    const bad = structuredClone(notesForm) as Record<string, unknown>;
    (
      (bad['pages'] as Record<string, unknown>[])[0][
        'fields'
      ] as Record<string, unknown>[]
    )[0]['bogus'] = true;
    expect(formDefinitionSchema.safeParse(bad).success).toBe(false);
  });

  it('normalizeFormDefinition keeps notes props and strips irrelevant ones', () => {
    const raw = {
      id: 'f',
      pages: [
        {
          id: 'p1',
          fields: [
            {
              id: 'n1',
              fieldType: 'notes',
              entryLabel: 'Comment',
              options: [{ id: 'x', value: 'y' }], // not a notes prop
            },
          ],
        },
      ],
    };
    const normalized = normalizeFormDefinition(raw);
    const field = (
      (normalized['pages'] as Record<string, unknown>[])[0][
        'fields'
      ] as Record<string, unknown>[]
    )[0];
    expect(field['entryLabel']).toBe('Comment');
    expect(field['options']).toBeUndefined();
  });

  it('validates NoteEntry shape (id, createdAt, markdown required)', () => {
    expect(noteEntrySchema.safeParse(makeNote()).success).toBe(true);
    expect(
      noteEntrySchema.safeParse({ id: 'a', markdown: 'no createdAt' }).success
    ).toBe(false);
    expect(
      noteEntrySchema.safeParse(
        makeNote({
          attachments: [{ contentType: 'image/png', dataUrl: 'data:...' }],
        })
      ).success
    ).toBe(true);
  });
});

describe('notes field registry metadata', () => {
  it('is registered with notes answerType and default props', () => {
    const meta = getFieldTypeMeta('notes');
    expect(meta).toBeDefined();
    expect(meta?.label).toBe('Notes');
    expect(meta?.answerType).toBe('notes');
    expect(meta?.defaultProps).toMatchObject({
      entryLabel: 'Note',
      sortOrder: 'newest',
    });
  });
});

describe('notes field validation', () => {
  const normalized = normalizeDefinition(notesForm.pages);

  it('required notes field with no entries is an error', () => {
    const errors = validateField('case-notes', normalized, {});
    expect(errors).toMatchObject([{ fieldId: 'case-notes', rule: 'required' }]);
  });

  it('required is satisfied by at least one entry', () => {
    const errors = validateField('case-notes', normalized, {
      'case-notes': { notes: [makeNote()] },
    });
    expect(errors).toEqual([]);
  });

  it('empty notes array counts as unanswered', () => {
    const errors = validateField('case-notes', normalized, {
      'case-notes': { notes: [] },
    });
    expect(errors).toMatchObject([{ fieldId: 'case-notes', rule: 'required' }]);
  });
});

describe('notes field response extraction', () => {
  it('extractResponseValue returns the notes array', () => {
    const notes = [makeNote()];
    expect(extractResponseValue({ notes })).toBe(notes);
    expect(extractResponseValue({ notes: [] })).toBeUndefined();
  });

  it('hydrateResponse carries NoteEntry[] as the answer', () => {
    const normalized = normalizeDefinition(notesForm.pages);
    const notes = [makeNote({ author: 'Dr. Demo' })];
    const envelope = hydrateResponse(normalized, {
      'case-notes': { notes },
    });
    const item = envelope.items.find((i) => i.id === 'case-notes');
    expect(item?.answer).toBe(notes);
  });
});
