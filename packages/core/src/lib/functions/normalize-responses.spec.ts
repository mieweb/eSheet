import { describe, it, expect } from 'vitest';
import {
  normalizeResponses,
  extractResponseValue,
} from './normalize-responses.js';
import type { FieldResponse, FieldResponseMap } from '../types.js';

describe('extractResponseValue', () => {
  it('returns undefined for empty response', () => {
    expect(extractResponseValue(undefined)).toBe(undefined);
    expect(extractResponseValue({})).toBe(undefined);
  });

  it('extracts text answer', () => {
    const response: FieldResponse = { answer: 'Hello' };
    expect(extractResponseValue(response)).toBe('Hello');
  });

  it('extracts structured richtext answer', () => {
    const response: FieldResponse = {
      answer: {
        frontmatter: { q1: { value: 'John' } },
        body: 'Name: [John](#q1)\n',
      },
    };
    expect(extractResponseValue(response)).toEqual({
      frontmatter: { q1: { value: 'John' } },
      body: 'Name: [John](#q1)\n',
    });
  });

  it('extracts empty string answer', () => {
    const response: FieldResponse = { answer: '' };
    expect(extractResponseValue(response)).toBe('');
  });

  it('extracts single selection', () => {
    const response: FieldResponse = {
      selected: { id: 'opt1', value: 'Yes' },
    };
    expect(extractResponseValue(response)).toEqual({
      id: 'opt1',
      value: 'Yes',
    });
  });

  it('extracts multiple selections', () => {
    const response: FieldResponse = {
      selected: [
        { id: 'opt1', value: 'A' },
        { id: 'opt2', value: 'B' },
      ],
    };
    expect(extractResponseValue(response)).toEqual([
      { id: 'opt1', value: 'A' },
      { id: 'opt2', value: 'B' },
    ]);
  });

  it('extracts multitext answers', () => {
    const response: FieldResponse = {
      multitextAnswers: { opt1: 'text1', opt2: 'text2' },
    };
    expect(extractResponseValue(response)).toEqual({
      opt1: 'text1',
      opt2: 'text2',
    });
  });

  it('extracts signature data', () => {
    const response: FieldResponse = {
      signatureData: 'stroke-data',
      signatureImage: 'data:image/png;base64,...',
    };
    expect(extractResponseValue(response)).toEqual({
      type: 'signature',
      data: 'stroke-data',
      image: 'data:image/png;base64,...',
    });
  });

  it('extracts diagram data', () => {
    const response: FieldResponse = {
      markupData: 'markup-stroke-data',
      markupImage: 'data:image/png;base64,...',
    };
    expect(extractResponseValue(response)).toEqual({
      type: 'diagram',
      data: 'markup-stroke-data',
      image: 'data:image/png;base64,...',
    });
  });

  it('prefers answer over selected', () => {
    const response: FieldResponse = {
      answer: 'text',
      selected: { id: 'opt1', value: 'Yes' },
    };
    expect(extractResponseValue(response)).toBe('text');
  });
});

describe('normalizeResponses', () => {
  it('returns empty object for empty responses', () => {
    expect(normalizeResponses({})).toEqual({});
  });

  it('normalizes multiple field responses', () => {
    const responses: FieldResponseMap = {
      field1: { answer: 'Hello' },
      field2: { selected: { id: 'opt1', value: 'Yes' } },
      field3: { answer: '' },
    };
    expect(normalizeResponses(responses)).toEqual({
      field1: 'Hello',
      field2: { id: 'opt1', value: 'Yes' },
      field3: '',
    });
  });

  it('skips fields with undefined values', () => {
    const responses: FieldResponseMap = {
      field1: { answer: 'Hello' },
      field2: {}, // No value
    };
    expect(normalizeResponses(responses)).toEqual({
      field1: 'Hello',
    });
  });
});
