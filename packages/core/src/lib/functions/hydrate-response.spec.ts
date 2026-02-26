// ---------------------------------------------------------------------------
// Tests — hydrateResponse
// ---------------------------------------------------------------------------

import { normalizeDefinition } from './normalize.js';
import { hydrateResponse } from './hydrate-response.js';
import type { FieldDefinition, FormResponse } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkField(override: Partial<FieldDefinition> & Pick<FieldDefinition, 'id' | 'fieldType'>): FieldDefinition {
  return { question: 'Q', ...override };
}

function hydrate(fields: FieldDefinition[], responses: FormResponse) {
  return hydrateResponse(normalizeDefinition(fields), responses);
}

// ---------------------------------------------------------------------------
// Basic behaviour
// ---------------------------------------------------------------------------

describe('hydrateResponse', () => {
  it('returns empty array for empty form', () => {
    expect(hydrate([], {})).toEqual([]);
  });

  it('skips display fields (image, html)', () => {
    const fields = [
      mkField({ id: 'img', fieldType: 'image' }),
      mkField({ id: 'htm', fieldType: 'html' }),
    ];
    expect(hydrate(fields, {})).toEqual([]);
  });

  it('skips section container but includes its children', () => {
    const fields: FieldDefinition[] = [
      {
        id: 'sec', fieldType: 'section', title: 'Section',
        fields: [
          mkField({ id: 'child', fieldType: 'text', question: 'Inside' }),
        ],
      },
    ];
    const result = hydrate(fields, { child: { answer: 'hi' } });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('child');
    expect(result[0].text).toBe('Inside');
  });

  it('skips unknown field types with no registry entry', () => {
    const fields = [mkField({ id: 'x', fieldType: 'alien' as never })];
    expect(hydrate(fields, {})).toEqual([]);
  });

  it('includes id, text (question), and extracted answer', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'text', question: 'Name' })];
    const result = hydrate(fields, { f1: { answer: 'Alice' } });
    expect(result).toEqual([{
      id: 'f1',
      text: 'Name',
      answer: 'Alice',
    }]);
  });

  it('answer is undefined when unanswered', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'text' })];
    const result = hydrate(fields, {});
    expect(result[0].answer).toBeUndefined();
  });

  it('extracts selected option for selection fields', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'radio' })];
    const selected = { id: 'opt_1', value: 'Yes' };
    const result = hydrate(fields, { f1: { selected } });
    expect(result[0].answer).toEqual(selected);
  });

  it('extracts selected array for multiselection fields', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'check' })];
    const selected = [
      { id: 'a', value: 'Red' },
      { id: 'b', value: 'Green' },
    ];
    const result = hydrate(fields, { f1: { selected } });
    expect(result[0].answer).toEqual(selected);
  });

  it('extracts selected map for matrix fields', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'singlematrix' })];
    const selected = { r1: { id: 'c1', value: 'Col 1' } };
    const result = hydrate(fields, { f1: { selected } });
    expect(result[0].answer).toEqual(selected);
  });

  it('extracts multitextAnswers for multitext fields', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'multitext' })];
    const multitextAnswers = { opt_1: 'Answer 1', opt_2: 'Answer 2' };
    const result = hydrate(fields, { f1: { multitextAnswers } });
    expect(result[0].answer).toEqual(multitextAnswers);
  });

  it('extracts signatureImage for media fields', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'signature' })];
    const result = hydrate(fields, {
      f1: { signatureImage: 'data:image/png;base64,abc' },
    });
    expect(result[0].answer).toBe('data:image/png;base64,abc');
  });

  it('falls back to signatureData when no image', () => {
    const fields = [mkField({ id: 'f1', fieldType: 'signature' })];
    const result = hydrate(fields, { f1: { signatureData: '[[stroke]]' } });
    expect(result[0].answer).toBe('[[stroke]]');
  });

  it('uses title as text fallback when question is absent', () => {
    const fields: FieldDefinition[] = [
      mkField({ id: 'f1', fieldType: 'text', question: undefined, title: 'Fallback' } as never),
    ];
    const result = hydrate(fields, {});
    expect(result[0].text).toBe('Fallback');
  });

  it('preserves field order (root + nested)', () => {
    const fields: FieldDefinition[] = [
      mkField({ id: 'a', fieldType: 'text', question: 'A' }),
      {
        id: 'sec', fieldType: 'section', title: 'Sec',
        fields: [
          mkField({ id: 'b', fieldType: 'text', question: 'B' }),
          mkField({ id: 'c', fieldType: 'text', question: 'C' }),
        ],
      },
      mkField({ id: 'd', fieldType: 'text', question: 'D' }),
    ];
    const result = hydrate(fields, {
      a: { answer: '1' }, b: { answer: '2' },
      c: { answer: '3' }, d: { answer: '4' },
    });
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
