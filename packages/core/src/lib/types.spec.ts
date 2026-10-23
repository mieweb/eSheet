import {
  FIELD_TYPES,
  SECTION_ICON_GROUPS,
  SECTION_ICON_NAMES,
  formDefinitionSchema,
  fieldDefinitionSchema,
  normalizeFormDefinition,
  getFormDefinitionJSONSchema,
} from './types.js';
import { registerFieldType, resetFieldTypeRegistry } from './registry.js';
import type {
  FieldDefinition,
  FieldResponse,
  FormDefinition,
  FieldResponseMap,
} from './types.js';

describe('schema types', () => {
  it('should export all field types', () => {
    expect(FIELD_TYPES).toContain('text');
    expect(FIELD_TYPES).toContain('section');
    expect(FIELD_TYPES).toContain('display');
    expect(FIELD_TYPES).toContain('file');
    expect(FIELD_TYPES).toContain('openchoice');
    expect(FIELD_TYPES).toHaveLength(23);
  });

  it('should allow constructing a valid FormDefinition', () => {
    const field: FieldDefinition = {
      id: 'q1',
      fieldType: 'text',
      question: 'What is your name?',
    };

    const form: FormDefinition = {
      id: 'test-form',
      title: 'Test Form',
      pages: [{ id: 'page-1', fields: [field] }],
    };

    expect(form.pages[0].fields).toHaveLength(1);
  });

  it('should allow constructing a response map', () => {
    const responses: FieldResponseMap = {
      q1: { answer: 'John' },
      q2: { selected: { id: 'opt-yes', value: 'Yes' } },
      q3: {
        selected: [
          { id: 'opt-a', value: 'Option A' },
          { id: 'opt-b', value: 'Option B' },
        ],
      },
    };

    expect(Object.keys(responses)).toHaveLength(3);
  });

  it('should keep definition and response separate', () => {
    const definition: FieldDefinition = {
      id: 'q1',
      fieldType: 'radio',
      question: 'Do you agree?',
      options: [
        { id: 'opt-yes', value: 'Yes' },
        { id: 'opt-no', value: 'No' },
      ],
    };

    const response: FieldResponse = {
      selected: { id: 'opt-yes', value: 'Yes' },
    };

    // Definition has no answer properties
    expect(definition).not.toHaveProperty('answer');
    expect(definition).not.toHaveProperty('selected');

    // Response has no definition properties
    expect(response).not.toHaveProperty('fieldType');
    expect(response).not.toHaveProperty('question');
  });

  it('should reject unknown top-level form properties', () => {
    const result = formDefinitionSchema.safeParse({
      id: 'comprehensive',
      unknown: true,
      pages: [],
    });

    expect(result.success).toBe(false);
  });

  it('should reject unknown field properties', () => {
    const result = fieldDefinitionSchema.safeParse({
      id: 'q1',
      fieldType: 'text',
      question: 'Name',
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it('accepts an optional positive integer minimum row count for longtext', () => {
    const field = { id: 'notes', fieldType: 'longtext' };

    expect(fieldDefinitionSchema.parse(field)).not.toHaveProperty('rows');
    expect(fieldDefinitionSchema.parse({ ...field, rows: 5 })).toEqual({
      ...field,
      rows: 5,
    });
  });

  it.each([0, -1, 1.5, '4', null])(
    'rejects an invalid longtext row count: %s',
    (rows) => {
      expect(
        fieldDefinitionSchema.safeParse({
          id: 'notes',
          fieldType: 'longtext',
          rows,
        }).success
      ).toBe(false);
    }
  );

  it('accepts an optional maximum row count and matching row bounds', () => {
    const field = { id: 'notes', fieldType: 'longtext' };

    expect(fieldDefinitionSchema.parse(field)).not.toHaveProperty('maxRows');
    expect(fieldDefinitionSchema.parse({ ...field, maxRows: 5 })).toEqual({
      ...field,
      maxRows: 5,
    });
    expect(
      fieldDefinitionSchema.safeParse({ ...field, rows: 5, maxRows: 5 }).success
    ).toBe(true);
    expect(
      fieldDefinitionSchema.safeParse({ ...field, rows: 6, maxRows: 5 }).success
    ).toBe(false);
  });

  it.each([0, -1, 1.5, '4', null])(
    'rejects an invalid longtext maximum row count: %s',
    (maxRows) => {
      expect(
        fieldDefinitionSchema.safeParse({
          id: 'notes',
          fieldType: 'longtext',
          maxRows,
        }).success
      ).toBe(false);
    }
  );

  it('should accept conditional rules on options', () => {
    const result = formDefinitionSchema.safeParse({
      id: 'option-rules',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'country',
              fieldType: 'radio',
              options: [{ id: 'us', value: 'United States' }],
            },
            {
              id: 'location',
              fieldType: 'dropdown',
              options: [
                {
                  id: 'houston-hq',
                  value: 'Houston HQ',
                  rules: [
                    {
                      effect: 'visible',
                      logic: 'AND',
                      conditions: [
                        {
                          conditionType: 'field',
                          targetId: 'country',
                          operator: 'equals',
                          expected: 'us',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('should preserve supported field properties during normalization', () => {
    const normalized = normalizeFormDefinition({
      id: 'form',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'text',
              fieldType: 'text',
              inputType: 'datetime-local',
              dateRange: { amount: 2, unit: 'years' },
              timeFormat: '12-hour',
              overrideSectionWidth: true,
            },
            {
              id: 'longtext',
              fieldType: 'longtext',
              dateRange: { amount: 1, unit: 'months' },
            },
            {
              id: 'matrix',
              fieldType: 'singlematrix',
              scored: true,
              scoreStart: 1,
            },
            {
              id: 'multimatrix',
              fieldType: 'multimatrix',
              scored: true,
              scoreStart: 1,
            },
            {
              id: 'openchoice',
              fieldType: 'openchoice',
              optionLayout: 'wrap',
            },
            {
              id: 'section',
              fieldType: 'section',
              sectionIcon: 'folder',
              sectionCollapse: 'collapsed',
            },
            {
              id: 'pages',
              fieldType: 'pages',
              autoAdvance: true,
            },
          ],
        },
      ],
    });

    expect(formDefinitionSchema.safeParse(normalized).success).toBe(true);
    expect(normalized.pages).toEqual([
      {
        id: 'page-1',
        fields: [
          {
            id: 'text',
            fieldType: 'text',
            inputType: 'datetime-local',
            dateRange: { amount: 2, unit: 'years' },
            timeFormat: '12-hour',
            overrideSectionWidth: true,
          },
          {
            id: 'longtext',
            fieldType: 'longtext',
            dateRange: { amount: 1, unit: 'months' },
          },
          {
            id: 'matrix',
            fieldType: 'singlematrix',
            scored: true,
            scoreStart: 1,
          },
          {
            id: 'multimatrix',
            fieldType: 'multimatrix',
            scored: true,
            scoreStart: 1,
          },
          {
            id: 'openchoice',
            fieldType: 'openchoice',
            optionLayout: 'wrap',
          },
          {
            id: 'section',
            fieldType: 'section',
            sectionIcon: 'folder',
            sectionCollapse: 'collapsed',
          },
          {
            id: 'pages',
            fieldType: 'pages',
            autoAdvance: true,
          },
        ],
      },
    ]);
  });

  it('preserves text defaults through normalization at the root and inside sections', () => {
    const fields: FieldDefinition[] = [
      { id: 'text', fieldType: 'text', defaultAnswer: 'Short answer' },
      { id: 'longtext', fieldType: 'longtext', defaultAnswer: 'Long answer' },
    ];
    const definition: FormDefinition = {
      id: 'defaults',
      pages: [
        {
          id: 'page',
          fields: [...fields, { id: 'section', fieldType: 'section', fields }],
        },
      ],
    };

    expect(normalizeFormDefinition(definition)).toEqual(definition);
    expect(formDefinitionSchema.safeParse(definition).success).toBe(true);
  });

  it('only exposes defaultAnswer on text fields in the generated JSON Schema', () => {
    const seen = new Set<string>();
    function check(value: unknown) {
      if (!value || typeof value !== 'object') return;
      if (
        'properties' in value &&
        value.properties &&
        typeof value.properties === 'object' &&
        'fieldType' in value.properties
      ) {
        const fieldType = value.properties.fieldType;
        if (
          fieldType &&
          typeof fieldType === 'object' &&
          'const' in fieldType &&
          typeof fieldType.const === 'string'
        ) {
          seen.add(fieldType.const);
          expect('defaultAnswer' in value.properties).toBe(
            fieldType.const === 'text' || fieldType.const === 'longtext'
          );
        }
      }
      for (const child of Object.values(value)) check(child);
    }

    check(getFormDefinitionJSONSchema());
    expect([...seen].sort()).toEqual([...FIELD_TYPES].sort());
  });
});

describe('section icon validation', () => {
  it('validates representative icons from every requested group', () => {
    expect(SECTION_ICON_GROUPS).toHaveLength(7);
    expect(SECTION_ICON_GROUPS.map((group) => group.label)).toEqual([
      'User & Account',
      'Media & Files',
      'Time & Calendar',
      'Layout & View',
      'Security',
      'Healthcare & Medical',
      'Misc',
    ]);

    for (const group of SECTION_ICON_GROUPS) {
      for (const icon of group.icons) {
        expect(SECTION_ICON_NAMES).toContain(icon.name);
        expect(
          fieldDefinitionSchema.safeParse({
            id: 'section',
            fieldType: 'section',
            sectionIcon: icon.name,
          }).success
        ).toBe(true);
      }
    }

    const groupedNames = SECTION_ICON_GROUPS.flatMap((group) =>
      group.icons.map((icon) => icon.name)
    );
    expect(new Set(SECTION_ICON_NAMES).size).toBe(SECTION_ICON_NAMES.length);
    expect(new Set(groupedNames).size).toBe(groupedNames.length);
    expect(new Set(groupedNames)).toEqual(new Set(SECTION_ICON_NAMES));
  });

  it('accepts canonical section icons and rejects unknown values', () => {
    for (const sectionIcon of ['folder', 'info', 'clipboard'] as const) {
      expect(
        fieldDefinitionSchema.safeParse({
          id: 'section',
          fieldType: 'section',
          sectionIcon,
        }).success
      ).toBe(true);
    }

    expect(
      fieldDefinitionSchema.safeParse({
        id: 'section',
        fieldType: 'section',
        sectionIcon: 'custom-svg',
      }).success
    ).toBe(false);
  });
});

describe('custom field type validation', () => {
  afterEach(() => {
    resetFieldTypeRegistry();
  });

  const registerVitals = () =>
    registerFieldType('vitals', {
      label: 'Vitals',
      category: 'rich',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
    });

  it('should accept a registered custom field type with extra props', () => {
    registerVitals();

    const result = formDefinitionSchema.safeParse({
      id: 'form',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'v1',
              fieldType: 'vitals',
              question: 'Vitals',
              // custom types may carry arbitrary configuration props
              units: 'metric',
              panels: ['bp', 'pulse'],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('validates defaults on registered custom fields by response type', () => {
    registerVitals();
    const field = {
      id: 'v1',
      fieldType: 'vitals',
      defaultAnswer: 'Initial vitals',
    };
    expect(fieldDefinitionSchema.parse(field)).toEqual(field);
    expect(
      fieldDefinitionSchema.safeParse({ ...field, defaultAnswer: 42 }).success
    ).toBe(false);

    registerFieldType('customChoice', {
      label: 'Custom choice',
      category: 'selection',
      answerType: 'selection',
      hasOptions: true,
      hasMatrix: false,
      defaultProps: {},
    });
    expect(
      fieldDefinitionSchema.safeParse({
        ...field,
        fieldType: 'customChoice',
      }).success
    ).toBe(false);
  });

  it('should reject an unregistered field type', () => {
    const result = formDefinitionSchema.safeParse({
      id: 'form',
      pages: [
        { id: 'page-1', fields: [{ id: 'x1', fieldType: 'notRegistered' }] },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('should keep strict validation for built-in types even when custom types are registered', () => {
    registerVitals();

    // A built-in type with a bogus prop must NOT sneak through the loose
    // custom branch.
    const result = fieldDefinitionSchema.safeParse({
      id: 'q1',
      fieldType: 'text',
      bogus: true,
    });

    expect(result.success).toBe(false);
  });

  it('should require base props on custom field types', () => {
    registerVitals();

    // Missing required `id`
    const result = fieldDefinitionSchema.safeParse({ fieldType: 'vitals' });

    expect(result.success).toBe(false);
  });
});
