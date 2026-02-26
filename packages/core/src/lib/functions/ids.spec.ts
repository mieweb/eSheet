import {
  generateFieldId,
  generateOptionId,
  generateRowId,
  generateColumnId,
} from './ids.js';

describe('generateFieldId', () => {
  it('should use fieldType as base when no collisions', () => {
    expect(generateFieldId('text', new Set())).toBe('text');
  });

  it('should append -1 when base already exists', () => {
    expect(generateFieldId('text', new Set(['text']))).toBe('text-1');
  });

  it('should increment past existing numbered IDs', () => {
    expect(generateFieldId('text', new Set(['text', 'text-1', 'text-2']))).toBe('text-3');
  });

  it('should find the max number even if gaps exist', () => {
    expect(generateFieldId('text', new Set(['text', 'text-1', 'text-5']))).toBe('text-6');
  });

  it('should prefix with parentId for nested fields', () => {
    expect(generateFieldId('text', new Set(), 's1')).toBe('s1-text');
  });

  it('should handle collisions with parentId prefix', () => {
    expect(generateFieldId('text', new Set(['s1-text']), 's1')).toBe('s1-text-1');
  });

  it('should default to "field" when fieldType is empty', () => {
    expect(generateFieldId('', new Set())).toBe('field');
  });

  it('should not collide with partial matches', () => {
    // 'text-extra' should NOT match the pattern 'text-\d+'
    expect(generateFieldId('text', new Set(['text', 'text-extra']))).toBe('text-1');
  });
});

describe('generateOptionId', () => {
  it('should use fieldId-option as base', () => {
    expect(generateOptionId(new Set(), 'radio')).toBe('radio-option');
  });

  it('should increment when base exists', () => {
    expect(generateOptionId(new Set(['radio-option']), 'radio')).toBe('radio-option-1');
  });

  it('should increment past existing numbered IDs', () => {
    expect(
      generateOptionId(new Set(['radio-option', 'radio-option-1', 'radio-option-2']), 'radio'),
    ).toBe('radio-option-3');
  });

  it('should default to "option" when no fieldId', () => {
    expect(generateOptionId(new Set())).toBe('option');
  });
});

describe('generateRowId', () => {
  it('should use fieldId-row as base', () => {
    expect(generateRowId(new Set(), 'matrix')).toBe('matrix-row');
  });

  it('should increment when base exists', () => {
    expect(generateRowId(new Set(['matrix-row', 'matrix-row-1']), 'matrix')).toBe('matrix-row-2');
  });

  it('should default to "row" when no fieldId', () => {
    expect(generateRowId(new Set())).toBe('row');
  });
});

describe('generateColumnId', () => {
  it('should use fieldId-col as base', () => {
    expect(generateColumnId(new Set(), 'matrix')).toBe('matrix-col');
  });

  it('should increment when base exists', () => {
    expect(generateColumnId(new Set(['matrix-col', 'matrix-col-1']), 'matrix')).toBe(
      'matrix-col-2',
    );
  });

  it('should default to "col" when no fieldId', () => {
    expect(generateColumnId(new Set())).toBe('col');
  });
});
