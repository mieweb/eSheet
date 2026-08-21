import {
  captureAttributes,
  parseAutocompleteItems,
  resolveResultsPath,
} from './AutocompleteField.js';

describe('parseAutocompleteItems', () => {
  it('parses Wikipedia opensearch arrays using urls as ids', () => {
    const data = [
      'cat',
      ['Cat', 'Catfish'],
      ['', ''],
      [
        'https://en.wikipedia.org/wiki/Cat',
        'https://en.wikipedia.org/wiki/Catfish',
      ],
    ];
    expect(parseAutocompleteItems(data)).toEqual([
      { id: 'https://en.wikipedia.org/wiki/Cat', value: 'Cat' },
      { id: 'https://en.wikipedia.org/wiki/Catfish', value: 'Catfish' },
    ]);
  });

  it('falls back to the title as id when opensearch urls are missing', () => {
    expect(parseAutocompleteItems(['cat', ['Cat']])).toEqual([
      { id: 'Cat', value: 'Cat' },
    ]);
  });

  it('parses string arrays', () => {
    expect(parseAutocompleteItems(['Red', 'Blue'])).toEqual([
      { id: 'Red', value: 'Red' },
      { id: 'Blue', value: 'Blue' },
    ]);
  });

  it('parses object arrays with labelKey and valueKey', () => {
    const data = [
      { name: 'Ada', code: 1 },
      { name: 'Grace', code: 2 },
      { code: 3 }, // missing label — dropped
    ];
    expect(parseAutocompleteItems(data, 'name', 'code')).toEqual([
      { id: '1', value: 'Ada', raw: data[0] },
      { id: '2', value: 'Grace', raw: data[1] },
    ]);
  });

  it('defaults valueKey to labelKey', () => {
    const data = [{ title: 'Ada' }];
    expect(parseAutocompleteItems(data, 'title')).toEqual([
      { id: 'Ada', value: 'Ada', raw: data[0] },
    ]);
  });

  it('unwraps enveloped responses via resultsPath', () => {
    const data = { data: { items: [{ label: 'Ada' }] } };
    expect(
      parseAutocompleteItems(data, undefined, undefined, 'data.items')
    ).toEqual([{ id: 'Ada', value: 'Ada', raw: { label: 'Ada' } }]);
  });

  it('returns an empty array for a bad resultsPath', () => {
    expect(
      parseAutocompleteItems({ results: [] }, undefined, undefined, 'nope.deep')
    ).toEqual([]);
  });

  it('returns an empty array for non-array data', () => {
    expect(parseAutocompleteItems(null)).toEqual([]);
    expect(parseAutocompleteItems({ items: [] })).toEqual([]);
    expect(parseAutocompleteItems('nope')).toEqual([]);
  });
});

describe('resolveResultsPath', () => {
  it('returns data unchanged without a path', () => {
    const data = [1, 2];
    expect(resolveResultsPath(data)).toBe(data);
    expect(resolveResultsPath(data, '')).toBe(data);
  });

  it('descends dot-paths and tolerates missing segments', () => {
    expect(resolveResultsPath({ a: { b: [1] } }, 'a.b')).toEqual([1]);
    expect(resolveResultsPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(resolveResultsPath(null, 'a')).toBeUndefined();
  });
});

describe('captureAttributes', () => {
  const raw = { city: 'Toledo', state: 'OH', zip: 43604, tags: null };

  it('copies requested keys as strings', () => {
    expect(captureAttributes(raw, ['city', 'state', 'zip'])).toEqual({
      city: 'Toledo',
      state: 'OH',
      zip: '43604',
    });
  });

  it('skips missing and null keys', () => {
    expect(captureAttributes(raw, ['tags', 'nope'])).toBeUndefined();
  });

  it('returns undefined without raw data or keys', () => {
    expect(captureAttributes(undefined, ['city'])).toBeUndefined();
    expect(captureAttributes(raw, [])).toBeUndefined();
    expect(captureAttributes(raw)).toBeUndefined();
  });
});
