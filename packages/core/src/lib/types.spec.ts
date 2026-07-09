import {
  FIELD_TYPES,
  formDefinitionSchema,
  fieldDefinitionSchema,
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
    expect(FIELD_TYPES).toHaveLength(21);
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
      fields: [field],
    };

    expect(form.fields).toHaveLength(1);
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
      fields: [],
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
    });

    expect(result.success).toBe(true);
  });

  it('should reject an unregistered field type', () => {
    const result = formDefinitionSchema.safeParse({
      id: 'form',
      fields: [{ id: 'x1', fieldType: 'notRegistered' }],
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
