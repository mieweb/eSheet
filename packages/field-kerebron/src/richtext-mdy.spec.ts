import { describe, expect, it } from 'vitest';
import type { FieldNode, FormState } from '@esheet/core';

import {
  ESHEET_FIELD_ID_RE,
  answersToFrontmatterMeta,
  buildRichTextAnswer,
  getRichTextBody,
  isRichTextAnswer,
  rewriteEsheetMarkdownRefs,
  rewriteRichTextAnswerRefs,
  stripFrontmatter,
  toMetaEntry,
} from './richtext-mdy.js';
import { resolveMetaLabel } from './NodeESheetField.js';

function fieldNode(
  id: string,
  fieldType: string,
): FieldNode {
  return {
    definition: { id, fieldType } as FieldNode['definition'],
    parentId: null,
    childIds: [],
    index: 0,
  };
}

function mockFormState(
  responses: FormState['responses'],
  fields: Record<string, FieldNode>,
): Pick<FormState, 'responses' | 'getField'> {
  return {
    responses,
    getField: (id: string) => fields[id],
  };
}

describe('ESHEET_FIELD_ID_RE', () => {
  it('accepts hyphenated eSheet field ids', () => {
    expect(ESHEET_FIELD_ID_RE.test('what-is-your-email')).toBe(true);
    expect(ESHEET_FIELD_ID_RE.test('patient_name')).toBe(true);
    expect(ESHEET_FIELD_ID_RE.test('score.total')).toBe(true);
  });

  it('rejects invalid ids', () => {
    expect(ESHEET_FIELD_ID_RE.test('1abc')).toBe(false);
    expect(ESHEET_FIELD_ID_RE.test('has spaces')).toBe(false);
    expect(ESHEET_FIELD_ID_RE.test('')).toBe(false);
  });
});

describe('stripFrontmatter', () => {
  it('returns body-only content from a full MDY document', () => {
    const mdy = [
      '---',
      'what-is-your-email:',
      '  value: a@b.com',
      '---',
      '',
      'Hello **world**',
    ].join('\n');
    expect(stripFrontmatter(mdy)).toBe('Hello **world**');
  });

  it('leaves body-only markdown unchanged', () => {
    expect(stripFrontmatter('# Title\n\nBody')).toBe('# Title\n\nBody');
  });

  it('leaves unclosed frontmatter unchanged', () => {
    const raw = '---\nfoo: 1\nno closer';
    expect(stripFrontmatter(raw)).toBe(raw);
  });
});

describe('toMetaEntry / structured response output', () => {
  it('maps single selection to value + display', () => {
    expect(toMetaEntry({ id: 'opt1', value: 'Yes' })).toEqual({
      value: 'Yes',
      display: 'Yes',
    });
  });

  it('maps multi selection to value array + joined display', () => {
    expect(
      toMetaEntry([
        { id: 'a', value: 'Red' },
        { id: 'b', value: 'Blue' },
      ]),
    ).toEqual({
      value: ['Red', 'Blue'],
      display: 'Red, Blue',
    });
  });

  it('maps plain answers to value only', () => {
    expect(toMetaEntry('hello')).toEqual({ value: 'hello' });
    expect(toMetaEntry(42)).toEqual({ value: 42 });
  });
});

describe('answersToFrontmatterMeta', () => {
  it('includes hyphenated field ids as meta keys', () => {
    const state = mockFormState(
      {
        'what-is-your-email': { answer: 'user@example.com' },
        notes: {
          answer: buildRichTextAnswer('body', {
            'what-is-your-email': { value: 'user@example.com' },
          }),
        },
      },
      {
        'what-is-your-email': fieldNode('what-is-your-email', 'text'),
        notes: fieldNode('notes', 'richtext'),
      },
    );

    expect(answersToFrontmatterMeta(state, 'notes')).toEqual({
      'what-is-your-email': { value: 'user@example.com' },
    });
  });

  it('omits self and peer richtext fields (no nested MDY / bodies)', () => {
    const state = mockFormState(
      {
        'what-is-your-email': { answer: 'a@b.com' },
        notes_a: {
          answer: buildRichTextAnswer('Note A body', {
            'what-is-your-email': { value: 'a@b.com' },
          }),
        },
        notes_b: {
          answer: buildRichTextAnswer('Other note body', {
            'what-is-your-email': { value: 'a@b.com' },
          }),
        },
        choice: { selected: { id: 'y', value: 'Yes' } },
      },
      {
        'what-is-your-email': fieldNode('what-is-your-email', 'text'),
        notes_a: fieldNode('notes_a', 'richtext'),
        notes_b: fieldNode('notes_b', 'richtext'),
        choice: fieldNode('choice', 'radio'),
      },
    );

    const metaA = answersToFrontmatterMeta(state, 'notes_a');
    expect(metaA).toEqual({
      'what-is-your-email': { value: 'a@b.com' },
      choice: { value: 'Yes', display: 'Yes' },
    });
    expect(metaA).not.toHaveProperty('notes_a');
    expect(metaA).not.toHaveProperty('notes_b');

    const metaB = answersToFrontmatterMeta(state, 'notes_b');
    expect(metaB).not.toHaveProperty('notes_a');
    expect(metaB).not.toHaveProperty('notes_b');
    expect(metaB['what-is-your-email']).toEqual({ value: 'a@b.com' });
  });

  it('supports structured selection output for MDY meta', () => {
    const state = mockFormState(
      {
        color: {
          selected: [
            { id: 'r', value: 'Red' },
            { id: 'g', value: 'Green' },
          ],
        },
        essay: {
          answer: buildRichTextAnswer('text', {
            color: { value: ['Red', 'Green'], display: 'Red, Green' },
          }),
        },
      },
      {
        color: fieldNode('color', 'check'),
        essay: fieldNode('essay', 'richtext'),
      },
    );

    expect(answersToFrontmatterMeta(state, 'essay')).toEqual({
      color: { value: ['Red', 'Green'], display: 'Red, Green' },
    });
  });
});

describe('structured richtext answer', () => {
  it('builds { frontmatter, body } payload', () => {
    expect(
      buildRichTextAnswer('Name: [John](#q1)\n', {
        q1: { value: 'John' },
      }),
    ).toEqual({
      frontmatter: { q1: { value: 'John' } },
      body: 'Name: [John](#q1)\n',
    });
  });

  it('detects structured answers and reads body', () => {
    const answer = buildRichTextAnswer('Hello', { q1: { value: 'John' } });
    expect(isRichTextAnswer(answer)).toBe(true);
    expect(isRichTextAnswer('plain')).toBe(false);
    expect(getRichTextBody(answer)).toBe('Hello');
    expect(getRichTextBody('---\nx: 1\n---\n\nLegacy')).toBe('Legacy');
    expect(getRichTextBody(undefined, 'fallback')).toBe('fallback');
  });

  it('rewrites body links and frontmatter keys on field rename', () => {
    const answer = buildRichTextAnswer('Name: [John](#q1)\n', {
      q1: { value: 'John' },
      other: { value: 'x' },
    });
    expect(rewriteRichTextAnswerRefs(answer, 'q1', 'patient-name')).toEqual({
      frontmatter: {
        'patient-name': { value: 'John' },
        other: { value: 'x' },
      },
      body: 'Name: [John](#patient-name)\n',
    });
  });
});

describe('rewriteEsheetMarkdownRefs (field-id rename)', () => {
  it('rewrites hyphenated markdown field links', () => {
    const src =
      'Email: [user](#what-is-your-email) and again [x](#what-is-your-email).';
    expect(
      rewriteEsheetMarkdownRefs(src, 'what-is-your-email', 'patient-email'),
    ).toBe('Email: [user](#patient-email) and again [x](#patient-email).');
  });

  it('rewrites dotted path suffix after renamed root id', () => {
    expect(
      rewriteEsheetMarkdownRefs('See [t](#score.total)', 'score', 'total-score'),
    ).toBe('See [t](#total-score.total)');
  });

  it('does not rewrite partial id prefixes', () => {
    const src = '[a](#email-address) [b](#email)';
    expect(rewriteEsheetMarkdownRefs(src, 'email', 'mail')).toBe(
      '[a](#email-address) [b](#mail)',
    );
  });
});

describe('resolveMetaLabel (hyphenated MDY load)', () => {
  it('resolves hyphenated keys from plain object meta', () => {
    const meta = {
      'what-is-your-email': { value: 'a@b.com', display: 'a@b.com' },
    };
    expect(resolveMetaLabel(meta, 'what-is-your-email')).toBe('a@b.com');
  });

  it('resolves hyphenated keys from Map meta', () => {
    const meta = new Map<string, unknown>([
      [
        'what-is-your-email',
        new Map<string, unknown>([
          ['value', 'a@b.com'],
          ['display', 'a@b.com'],
        ]),
      ],
    ]);
    expect(resolveMetaLabel(meta, 'what-is-your-email')).toBe('a@b.com');
  });
});
