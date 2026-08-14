import { getInheritedSectionWidth, normalizeDefinition } from './normalize.js';
import type {
  FieldDefinition,
  SectionFieldDefinition,
  TextFieldDefinition,
} from '../types.js';

describe('normalizeDefinition', () => {
  it('should return empty result for empty fields', () => {
    const result = normalizeDefinition([]);
    expect(result.byId).toEqual({});
    expect(result.pages).toEqual([]);
  });

  it('should flatten top-level fields into byId', () => {
    const fields: FieldDefinition[] = [
      { id: 'q1', fieldType: 'text', question: 'Name?' },
      { id: 'q2', fieldType: 'radio', question: 'Agree?' },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);

    expect(result.pages[0].fieldIds).toEqual(['q1', 'q2']);
    expect(Object.keys(result.byId)).toHaveLength(2);
    expect(result.byId['q1'].definition.fieldType).toBe('text');
    expect(result.byId['q2'].definition.fieldType).toBe('radio');
  });

  it('should materialize registered defaults for every field', () => {
    const result = normalizeDefinition([
      {
        id: 'page-1',
        fields: [
          { id: 'text', fieldType: 'text' },
          {
            id: 'section',
            fieldType: 'section',
            fields: [{ id: 'child', fieldType: 'longtext' }],
          },
        ],
      },
    ]);

    expect(result.byId['text'].definition.width).toBe('third');
    expect(result.byId['section'].definition.width).toBe('third');
    expect(
      (result.byId['section'].definition as SectionFieldDefinition)
        .sectionCollapse
    ).toBe('expanded');
    expect(result.byId['child'].definition.width).toBe('third');
    expect(
      (result.byId['child'].definition as { inputType?: string }).inputType
    ).toBe('string');
  });

  it('should materialize default option layouts', () => {
    const result = normalizeDefinition([
      {
        id: 'page-1',
        fields: [
          { id: 'radio', fieldType: 'radio' },
          { id: 'text', fieldType: 'text' },
        ],
      },
    ]);

    expect(
      (result.byId['radio'].definition as { optionLayout?: string })
        .optionLayout
    ).toBe('wrap');
    expect(
      (result.byId['text'].definition as { optionLayout?: string }).optionLayout
    ).toBeUndefined();
  });

  it('should set parentId to null for top-level fields', () => {
    const fields: FieldDefinition[] = [{ id: 'q1', fieldType: 'text' }];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['q1'].parentId).toBeNull();
  });

  it('should assign correct index to each field', () => {
    const fields: FieldDefinition[] = [
      { id: 'a', fieldType: 'text' },
      { id: 'b', fieldType: 'text' },
      { id: 'c', fieldType: 'text' },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['a'].index).toBe(0);
    expect(result.byId['b'].index).toBe(1);
    expect(result.byId['c'].index).toBe(2);
  });

  it('should set childIds to empty for non-section fields', () => {
    const fields: FieldDefinition[] = [{ id: 'q1', fieldType: 'text' }];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['q1'].childIds).toEqual([]);
  });

  it('should flatten section children into byId', () => {
    const fields: FieldDefinition[] = [
      {
        id: 'section1',
        fieldType: 'section',
        title: 'Personal Info',
        fields: [
          { id: 'name', fieldType: 'text', question: 'Name?' },
          { id: 'email', fieldType: 'text', question: 'Email?' },
        ],
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);

    // Section and its children are all in byId
    expect(Object.keys(result.byId)).toHaveLength(3);
    expect(result.byId['section1']).toBeDefined();
    expect(result.byId['name']).toBeDefined();
    expect(result.byId['email']).toBeDefined();
  });

  it('should link section to children via childIds', () => {
    const fields: FieldDefinition[] = [
      {
        id: 's1',
        fieldType: 'section',
        fields: [
          { id: 'q1', fieldType: 'text' },
          { id: 'q2', fieldType: 'radio' },
        ],
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['s1'].childIds).toEqual(['q1', 'q2']);
  });

  it('should set parentId on section children', () => {
    const fields: FieldDefinition[] = [
      {
        id: 's1',
        fieldType: 'section',
        fields: [{ id: 'q1', fieldType: 'text' }],
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['q1'].parentId).toBe('s1');
  });

  it('should only include top-level IDs in fieldIds', () => {
    const fields: FieldDefinition[] = [
      { id: 'q0', fieldType: 'text' },
      {
        id: 's1',
        fieldType: 'section',
        fields: [{ id: 'q1', fieldType: 'text' }],
      },
      { id: 'q2', fieldType: 'text' },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.pages[0].fieldIds).toEqual(['q0', 's1', 'q2']);
  });

  it('should strip the fields property from section definitions', () => {
    const fields: FieldDefinition[] = [
      {
        id: 's1',
        fieldType: 'section',
        title: 'Section',
        fields: [{ id: 'q1', fieldType: 'text' }],
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['s1'].definition).not.toHaveProperty('fields');
    expect((result.byId['s1'].definition as SectionFieldDefinition).title).toBe(
      'Section'
    );
  });

  it('should handle nested sections (recursive)', () => {
    const fields: FieldDefinition[] = [
      {
        id: 'outer',
        fieldType: 'section',
        fields: [
          {
            id: 'inner',
            fieldType: 'section',
            fields: [{ id: 'deep', fieldType: 'text', question: 'Deep?' }],
          },
        ],
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);

    expect(Object.keys(result.byId)).toHaveLength(3);
    expect(result.pages[0].fieldIds).toEqual(['outer']);

    expect(result.byId['outer'].childIds).toEqual(['inner']);
    expect(result.byId['outer'].parentId).toBeNull();

    expect(result.byId['inner'].childIds).toEqual(['deep']);
    expect(result.byId['inner'].parentId).toBe('outer');

    expect(result.byId['deep'].childIds).toEqual([]);
    expect(result.byId['deep'].parentId).toBe('inner');
  });

  it('should resolve the nearest defined section width for descendants', () => {
    const result = normalizeDefinition([
      {
        id: 'page-1',
        fields: [
          {
            id: 'outer',
            fieldType: 'section',
            width: 'half',
            fields: [
              {
                id: 'inner',
                fieldType: 'section',
                fields: [{ id: 'deep', fieldType: 'text' }],
              },
            ],
          },
        ],
      },
    ]);

    expect(getInheritedSectionWidth(result, 'deep')).toBe('third');
  });

  it('should prefer an inner section width over an outer section width', () => {
    const result = normalizeDefinition([
      {
        id: 'page-1',
        fields: [
          {
            id: 'outer',
            fieldType: 'section',
            width: 'half',
            fields: [
              {
                id: 'inner',
                fieldType: 'section',
                width: 'third',
                fields: [{ id: 'deep', fieldType: 'text' }],
              },
            ],
          },
        ],
      },
    ]);

    expect(getInheritedSectionWidth(result, 'deep')).toBe('third');
  });

  it('should inherit section width when the child override is false', () => {
    const result = normalizeDefinition([
      {
        id: 'page-1',
        fields: [
          {
            id: 'section',
            fieldType: 'section',
            width: 'half',
            fields: [
              {
                id: 'child',
                fieldType: 'text',
                width: 'third',
                overrideSectionWidth: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(getInheritedSectionWidth(result, 'child')).toBe('half');
  });

  it('should not inherit section width when the child opts out', () => {
    const result = normalizeDefinition([
      {
        id: 'page-1',
        fields: [
          {
            id: 'section',
            fieldType: 'section',
            width: 'half',
            fields: [
              {
                id: 'child',
                fieldType: 'text',
                width: 'third',
                overrideSectionWidth: true,
              },
            ],
          },
        ],
      },
    ]);

    expect(getInheritedSectionWidth(result, 'child')).toBeUndefined();
  });

  it('should handle section with empty fields array', () => {
    const fields: FieldDefinition[] = [
      { id: 's1', fieldType: 'section', fields: [] },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['s1'].childIds).toEqual([]);
  });

  it('should handle section with no fields property', () => {
    const fields: FieldDefinition[] = [{ id: 's1', fieldType: 'section' }];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['s1'].childIds).toEqual([]);
  });

  it('should assign correct index to section children', () => {
    const fields: FieldDefinition[] = [
      {
        id: 's1',
        fieldType: 'section',
        fields: [
          { id: 'a', fieldType: 'text' },
          { id: 'b', fieldType: 'text' },
          { id: 'c', fieldType: 'text' },
        ],
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    expect(result.byId['a'].index).toBe(0);
    expect(result.byId['b'].index).toBe(1);
    expect(result.byId['c'].index).toBe(2);
  });

  it('should preserve all definition properties except fields', () => {
    const fields: FieldDefinition[] = [
      {
        id: 'q1',
        fieldType: 'text',
        question: 'Name?',
        required: true,
        inputType: 'string',
        unit: 'kg',
      },
    ];

    const result = normalizeDefinition([{ id: 'page-1', fields }]);
    const def = result.byId['q1'].definition as TextFieldDefinition;
    expect(def.question).toBe('Name?');
    expect(def.required).toBe(true);
    expect(def.inputType).toBe('string');
    expect(def.unit).toBe('kg');
  });
});
