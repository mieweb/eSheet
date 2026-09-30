import { describe, expect, it } from 'vitest';
import {
  parseResponseReference,
  serializeResponseReference,
  type ResponseReference,
} from './response-reference.js';

describe('response references', () => {
  it.each([
    { collection: 'reviews', id: 'review-7' },
    { collection: 'cases', id: 'case-2', relationship: 'overview' },
  ])(
    'round-trips a pointer without copying target answers: %j',
    (reference) => {
      const answer = serializeResponseReference(reference);
      expect(JSON.parse(answer)).toEqual(reference);
      expect(parseResponseReference(answer)).toEqual(reference);
      expect(parseResponseReference(reference)).toEqual(reference);
    }
  );

  it.each([
    null,
    undefined,
    [],
    7,
    'not json',
    'null',
    '{}',
    { collection: 'reviews' },
    { collection: 'reviews', id: '' },
    { collection: ' ', id: '7' },
    { collection: 'reviews', id: 7 },
    { collection: 'reviews', id: '7\n' },
    { collection: 'reviews', id: '7', relationship: '' },
    { collection: 'reviews', id: '7', relationship: null },
  ])('rejects a malformed reference: %j', (value) => {
    expect(parseResponseReference(value)).toBeNull();
  });

  it.each(['answers', 'response', 'payload', 'token', 'credentials', 'href'])(
    'rejects extra %s data in objects and serialized answers',
    (key) => {
      const value = { collection: 'reviews', id: '7', [key]: 'secret' };
      expect(parseResponseReference(value)).toBeNull();
      expect(parseResponseReference(JSON.stringify(value))).toBeNull();
      expect(() =>
        serializeResponseReference(value as ResponseReference)
      ).toThrow('Invalid response reference');
    }
  );
});
