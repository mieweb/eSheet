import {
  SCHEMA_TYPE,
  FIELD_TYPES,
  NUMERIC_EXPRESSION_FORMATS,
} from './types.js';
import type {
  FieldDefinition,
  FieldResponse,
  FormDefinition,
  FormResponse,
} from './types.js';

describe('schema types', () => {
  it('should export the schema type constant', () => {
    expect(SCHEMA_TYPE).toBe('mieforms-v1.0');
  });

  it('should export all field types', () => {
    expect(FIELD_TYPES).toContain('text');
    expect(FIELD_TYPES).toContain('section');
    expect(FIELD_TYPES).toContain('expression');
    expect(FIELD_TYPES).toHaveLength(19);
  });

  it('should export numeric expression formats', () => {
    expect(NUMERIC_EXPRESSION_FORMATS).toContain('number');
    expect(NUMERIC_EXPRESSION_FORMATS).toContain('currency');
    expect(NUMERIC_EXPRESSION_FORMATS).toContain('percentage');
  });

  it('should allow constructing a valid FormDefinition', () => {
    const field: FieldDefinition = {
      id: 'q1',
      fieldType: 'text',
      question: 'What is your name?',
    };

    const form: FormDefinition = {
      schemaType: SCHEMA_TYPE,
      title: 'Test Form',
      fields: [field],
    };

    expect(form.fields).toHaveLength(1);
    expect(form.schemaType).toBe('mieforms-v1.0');
  });

  it('should allow constructing a response map', () => {
    const responses: FormResponse = {
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
});
