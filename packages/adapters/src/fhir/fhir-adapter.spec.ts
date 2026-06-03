// ---------------------------------------------------------------------------
// FHIR Adapter Tests
// ---------------------------------------------------------------------------

import type {
  FhirQuestionnaire,
  FhirQuestionnaireResponse,
  FhirQuestionnaireItem,
} from './types.js';

import {
  isFhirQuestionnaire,
  isFhirQuestionnaireResponse,
  mapFhirTypeToEsheet,
  mapEsheetTypeToFhir,
  convertAnswerOptionToFieldOption,
  mapFhirOperatorToEsheet,
  FHIR_EXT,
} from './utils.js';

import {
  importFromFhir,
  exportToFhir,
  importResponseFromFhir,
  exportResponseToFhir,
} from './fhir-adapter.js';

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

describe('isFhirQuestionnaire', () => {
  it('returns true for valid Questionnaire resource', () => {
    const q = { resourceType: 'Questionnaire', status: 'draft' };
    expect(isFhirQuestionnaire(q)).toBe(true);
  });

  it('returns false for QuestionnaireResponse', () => {
    const r = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'test',
      status: 'completed',
    };
    expect(isFhirQuestionnaire(r)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFhirQuestionnaire(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isFhirQuestionnaire('string')).toBe(false);
  });
});

describe('isFhirQuestionnaireResponse', () => {
  it('returns true for valid QuestionnaireResponse', () => {
    const r = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'test',
      status: 'completed',
    };
    expect(isFhirQuestionnaireResponse(r)).toBe(true);
  });

  it('returns false for Questionnaire', () => {
    const q = { resourceType: 'Questionnaire', status: 'draft' };
    expect(isFhirQuestionnaireResponse(q)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type Mapping
// ---------------------------------------------------------------------------

describe('mapFhirTypeToEsheet', () => {
  const makeItem = (
    type: FhirQuestionnaireItem['type'],
    opts?: Partial<FhirQuestionnaireItem>
  ): FhirQuestionnaireItem => ({
    linkId: 'test',
    type,
    ...opts,
  });

  it('maps string to text', () => {
    const result = mapFhirTypeToEsheet('string', makeItem('string'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('string');
  });

  it('maps text to longtext', () => {
    const result = mapFhirTypeToEsheet('text', makeItem('text'));
    expect(result.fieldType).toBe('longtext');
  });

  it('maps boolean to boolean', () => {
    const result = mapFhirTypeToEsheet('boolean', makeItem('boolean'));
    expect(result.fieldType).toBe('boolean');
  });

  it('maps date to text with date inputType', () => {
    const result = mapFhirTypeToEsheet('date', makeItem('date'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('date');
  });

  it('maps dateTime to text with datetime-local inputType', () => {
    const result = mapFhirTypeToEsheet('dateTime', makeItem('dateTime'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('datetime-local');
  });

  it('maps time to text with time inputType', () => {
    const result = mapFhirTypeToEsheet('time', makeItem('time'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('time');
  });

  it('maps url to text with url inputType', () => {
    const result = mapFhirTypeToEsheet('url', makeItem('url'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('url');
  });

  it('maps decimal to text with number inputType', () => {
    const result = mapFhirTypeToEsheet('decimal', makeItem('decimal'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('number');
  });

  it('maps integer to text with number inputType', () => {
    const result = mapFhirTypeToEsheet('integer', makeItem('integer'));
    expect(result.fieldType).toBe('text');
    expect(result.inputType).toBe('number');
  });

  it('maps integer with slider itemControl to slider', () => {
    const result = mapFhirTypeToEsheet(
      'integer',
      makeItem('integer', {
        extension: [
          {
            url: FHIR_EXT.ITEM_CONTROL,
            valueCodeableConcept: {
              coding: [{ code: 'slider' }],
            },
          },
        ],
      })
    );
    expect(result.fieldType).toBe('slider');
  });

  it('maps choice to radio by default', () => {
    const result = mapFhirTypeToEsheet('choice', makeItem('choice'));
    expect(result.fieldType).toBe('radio');
  });

  it('maps choice with repeats to check', () => {
    const result = mapFhirTypeToEsheet(
      'choice',
      makeItem('choice', { repeats: true })
    );
    expect(result.fieldType).toBe('check');
  });

  it('maps choice with drop-down itemControl to dropdown', () => {
    const result = mapFhirTypeToEsheet(
      'choice',
      makeItem('choice', {
        extension: [
          {
            url: FHIR_EXT.ITEM_CONTROL,
            valueCodeableConcept: {
              coding: [{ code: 'drop-down' }],
            },
          },
        ],
      })
    );
    expect(result.fieldType).toBe('dropdown');
  });

  it('maps group to section', () => {
    const result = mapFhirTypeToEsheet('group', makeItem('group'));
    expect(result.fieldType).toBe('section');
  });

  it('maps display to display', () => {
    const result = mapFhirTypeToEsheet('display', makeItem('display'));
    expect(result.fieldType).toBe('display');
  });

  it('maps attachment to diagram by default', () => {
    const result = mapFhirTypeToEsheet('attachment', makeItem('attachment'));
    expect(result.fieldType).toBe('diagram');
  });

  it('maps attachment with signatureRequired to signature', () => {
    const result = mapFhirTypeToEsheet(
      'attachment',
      makeItem('attachment', {
        extension: [
          {
            url: FHIR_EXT.SIGNATURE_REQUIRED,
            valueBoolean: true,
          },
        ],
      })
    );
    expect(result.fieldType).toBe('signature');
  });
});

describe('mapEsheetTypeToFhir', () => {
  it('maps text to string', () => {
    const result = mapEsheetTypeToFhir('text');
    expect(result.type).toBe('string');
  });

  it('maps text with number inputType to decimal', () => {
    const result = mapEsheetTypeToFhir('text', 'number');
    expect(result.type).toBe('decimal');
  });

  it('maps text with date inputType to date', () => {
    const result = mapEsheetTypeToFhir('text', 'date');
    expect(result.type).toBe('date');
  });

  it('maps longtext to text', () => {
    const result = mapEsheetTypeToFhir('longtext');
    expect(result.type).toBe('text');
  });

  it('maps boolean to boolean', () => {
    const result = mapEsheetTypeToFhir('boolean');
    expect(result.type).toBe('boolean');
  });

  it('maps radio to choice with radio-button itemControl', () => {
    const result = mapEsheetTypeToFhir('radio');
    expect(result.type).toBe('choice');
    expect(result.itemControl).toBe('radio-button');
  });

  it('maps check to choice with check-box and repeats', () => {
    const result = mapEsheetTypeToFhir('check');
    expect(result.type).toBe('choice');
    expect(result.itemControl).toBe('check-box');
    expect(result.repeats).toBe(true);
  });

  it('maps dropdown to choice with drop-down itemControl', () => {
    const result = mapEsheetTypeToFhir('dropdown');
    expect(result.type).toBe('choice');
    expect(result.itemControl).toBe('drop-down');
  });

  it('maps section to group', () => {
    const result = mapEsheetTypeToFhir('section');
    expect(result.type).toBe('group');
  });

  it('maps signature to attachment', () => {
    const result = mapEsheetTypeToFhir('signature');
    expect(result.type).toBe('attachment');
  });
});

// ---------------------------------------------------------------------------
// Operator Mapping
// ---------------------------------------------------------------------------

describe('mapFhirOperatorToEsheet', () => {
  it('maps = to equals', () => {
    expect(mapFhirOperatorToEsheet('=')).toBe('equals');
  });

  it('maps != to notEquals', () => {
    expect(mapFhirOperatorToEsheet('!=')).toBe('notEquals');
  });

  it('maps > to greaterThan', () => {
    expect(mapFhirOperatorToEsheet('>')).toBe('greaterThan');
  });

  it('maps >= to greaterThanOrEqual', () => {
    expect(mapFhirOperatorToEsheet('>=')).toBe('greaterThanOrEqual');
  });

  it('maps < to lessThan', () => {
    expect(mapFhirOperatorToEsheet('<')).toBe('lessThan');
  });

  it('maps <= to lessThanOrEqual', () => {
    expect(mapFhirOperatorToEsheet('<=')).toBe('lessThanOrEqual');
  });

  it('maps exists with answerBoolean=true to notEmpty', () => {
    expect(mapFhirOperatorToEsheet('exists', true)).toBe('notEmpty');
  });

  it('maps exists with answerBoolean=false to empty', () => {
    expect(mapFhirOperatorToEsheet('exists', false)).toBe('empty');
  });
});

// ---------------------------------------------------------------------------
// Option Conversion
// ---------------------------------------------------------------------------

describe('convertAnswerOptionToFieldOption', () => {
  it('converts valueCoding option', () => {
    const existingIds = new Set<string>();
    const option = {
      valueCoding: {
        code: 'yes',
        display: 'Yes, I agree',
      },
    };

    const result = convertAnswerOptionToFieldOption(option, existingIds, 0);

    expect(result.id).toBe('yes');
    expect(result.value).toBe('yes');
    expect(result.text).toBe('Yes, I agree');
  });

  it('converts valueString option', () => {
    const existingIds = new Set<string>();
    const option = { valueString: 'Hello World' };

    const result = convertAnswerOptionToFieldOption(option, existingIds, 0);

    expect(result.id).toBe('hello-world');
    expect(result.value).toBe('Hello World');
  });

  it('converts valueInteger option', () => {
    const existingIds = new Set<string>();
    const option = { valueInteger: 42 };

    const result = convertAnswerOptionToFieldOption(option, existingIds, 0);

    expect(result.id).toBe('42');
    expect(result.value).toBe('42');
  });

  it('extracts ordinalValue score', () => {
    const existingIds = new Set<string>();
    const option = {
      valueCoding: { code: 'opt1', display: 'Option 1' },
      extension: [
        {
          url: FHIR_EXT.ORDINAL_VALUE,
          valueDecimal: 3,
        },
      ],
    };

    const result = convertAnswerOptionToFieldOption(option, existingIds, 0);

    expect(result.score).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Import: Basic Questionnaire
// ---------------------------------------------------------------------------

describe('importFromFhir', () => {
  it('imports a simple questionnaire', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      id: 'test-form',
      status: 'draft',
      title: 'Test Form',
      description: 'A test form',
      item: [
        {
          linkId: 'q1',
          text: 'What is your name?',
          type: 'string',
          required: true,
        },
        {
          linkId: 'q2',
          text: 'How old are you?',
          type: 'integer',
        },
      ],
    };

    const form = importFromFhir(fhir);

    expect(form.id).toBe('test-form');
    expect(form.title).toBe('Test Form');
    expect(form.description).toBe('A test form');
    expect(form.fields).toHaveLength(2);

    const [q1, q2] = form.fields;
    expect(q1.id).toBe('q1');
    expect(q1.fieldType).toBe('text');
    expect(q1.question).toBe('What is your name?');
    expect(q1.required).toBe(true);

    expect(q2.id).toBe('q2');
    expect(q2.fieldType).toBe('text');
    if (q2.fieldType === 'text') {
      expect(q2.inputType).toBe('number');
    }
  });

  it('imports choice fields with options', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          linkId: 'gender',
          text: 'What is your gender?',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'male', display: 'Male' } },
            { valueCoding: { code: 'female', display: 'Female' } },
            { valueCoding: { code: 'other', display: 'Other' } },
          ],
        },
      ],
    };

    const form = importFromFhir(fhir);
    const field = form.fields[0];

    expect(field.fieldType).toBe('radio');
    if (field.fieldType === 'radio') {
      expect(field.options).toHaveLength(3);
      expect(field.options?.[0].value).toBe('male');
      expect(field.options?.[0].text).toBe('Male');
    }
  });

  it('imports nested groups as sections', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          linkId: 'section1',
          text: 'Personal Info',
          type: 'group',
          item: [
            {
              linkId: 'name',
              text: 'Name',
              type: 'string',
            },
            {
              linkId: 'dob',
              text: 'Date of Birth',
              type: 'date',
            },
          ],
        },
      ],
    };

    const form = importFromFhir(fhir);
    const section = form.fields[0];

    expect(section.fieldType).toBe('section');
    if (section.fieldType === 'section') {
      expect(section.title).toBe('Personal Info');
      expect(section.fields).toHaveLength(2);
      expect(section.fields?.[0].id).toBe('name');
      expect(section.fields?.[1].id).toBe('dob');
      if (section.fields?.[1].fieldType === 'text') {
        expect(section.fields[1].inputType).toBe('date');
      }
    }
  });

  it('imports enableWhen conditions', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          linkId: 'has-condition',
          text: 'Do you have a condition?',
          type: 'boolean',
        },
        {
          linkId: 'condition-details',
          text: 'Please describe',
          type: 'text',
          enableWhen: [
            {
              question: 'has-condition',
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
      ],
    };

    const form = importFromFhir(fhir);
    const conditionalField = form.fields[1];

    expect(conditionalField.rules).toHaveLength(1);
    expect(conditionalField.rules?.[0].effect).toBe('visible');
    expect(conditionalField.rules?.[0].conditions[0].targetId).toBe(
      'has-condition'
    );
    expect(conditionalField.rules?.[0].conditions[0].operator).toBe('equals');
    expect(conditionalField.rules?.[0].conditions[0].expected).toBe('true');
  });

  it('preserves form metadata in _sourceData', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      id: 'test',
      url: 'http://example.com/Questionnaire/test',
      version: '1.0.0',
      status: 'active',
      publisher: 'Test Publisher',
      item: [],
    };

    const form = importFromFhir(fhir);
    const meta = form._sourceData as Record<string, unknown>;

    expect(meta.url).toBe('http://example.com/Questionnaire/test');
    expect(meta.version).toBe('1.0.0');
    expect(meta.status).toBe('active');
    expect(meta.publisher).toBe('Test Publisher');
  });

  it('allows overriding form ID via options', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      id: 'original-id',
      status: 'draft',
      item: [],
    };

    const form = importFromFhir(fhir, { formId: 'custom-id' });

    expect(form.id).toBe('custom-id');
  });
});

// ---------------------------------------------------------------------------
// Export: FormDefinition → FHIR
// ---------------------------------------------------------------------------

describe('exportToFhir', () => {
  it('exports a simple form to FHIR', () => {
    const form = {
      id: 'test-form',
      title: 'Test Form',
      fields: [
        {
          id: 'q1',
          fieldType: 'text' as const,
          question: 'What is your name?',
          required: true,
        },
        {
          id: 'q2',
          fieldType: 'boolean' as const,
          question: 'Do you agree?',
        },
      ],
    };

    const fhir = exportToFhir(form);

    expect(fhir.resourceType).toBe('Questionnaire');
    expect(fhir.id).toBe('test-form');
    expect(fhir.title).toBe('Test Form');
    expect(fhir.status).toBe('draft');
    expect(fhir.item).toHaveLength(2);

    expect(fhir.item?.[0].linkId).toBe('q1');
    expect(fhir.item?.[0].type).toBe('string');
    expect(fhir.item?.[0].required).toBe(true);

    expect(fhir.item?.[1].linkId).toBe('q2');
    expect(fhir.item?.[1].type).toBe('boolean');
  });

  it('exports choice fields with options', () => {
    const form = {
      id: 'test',
      fields: [
        {
          id: 'gender',
          fieldType: 'radio' as const,
          question: 'Gender',
          options: [
            { id: 'male', value: 'male', text: 'Male' },
            { id: 'female', value: 'female', text: 'Female' },
          ],
        },
      ],
    };

    const fhir = exportToFhir(form);
    const item = fhir.item?.[0];

    expect(item?.type).toBe('choice');
    expect(item?.answerOption).toHaveLength(2);
    expect(item?.answerOption?.[0].valueCoding?.code).toBe('male');
    expect(item?.answerOption?.[0].valueCoding?.display).toBe('Male');
  });

  it('exports sections as groups', () => {
    const form = {
      id: 'test',
      fields: [
        {
          id: 'section1',
          fieldType: 'section' as const,
          title: 'Section 1',
          fields: [
            {
              id: 'nested-q',
              fieldType: 'text' as const,
              question: 'Nested Question',
            },
          ],
        },
      ],
    };

    const fhir = exportToFhir(form);
    const section = fhir.item?.[0];

    expect(section?.type).toBe('group');
    expect(section?.text).toBe('Section 1');
    expect(section?.item).toHaveLength(1);
    expect(section?.item?.[0].linkId).toBe('nested-q');
  });

  it('exports visibility rules as enableWhen', () => {
    const form = {
      id: 'test',
      fields: [
        {
          id: 'q1',
          fieldType: 'boolean' as const,
          question: 'Show more?',
        },
        {
          id: 'q2',
          fieldType: 'text' as const,
          question: 'Details',
          rules: [
            {
              effect: 'visible' as const,
              logic: 'AND' as const,
              conditions: [
                {
                  conditionType: 'field' as const,
                  targetId: 'q1',
                  operator: 'equals' as const,
                  expected: 'true',
                },
              ],
            },
          ],
        },
      ],
    };

    const fhir = exportToFhir(form);
    const q2 = fhir.item?.[1];

    expect(q2?.enableWhen).toHaveLength(1);
    expect(q2?.enableWhen?.[0].question).toBe('q1');
    expect(q2?.enableWhen?.[0].operator).toBe('=');
    expect(q2?.enableWhen?.[0].answerBoolean).toBe(true);
  });

  it('applies export options', () => {
    const form = {
      id: 'test',
      fields: [],
    };

    const fhir = exportToFhir(form, {
      resourceId: 'custom-id',
      canonicalUrl: 'http://example.com/fhir',
      status: 'active',
      publisher: 'Test Publisher',
      dtrCompliant: true,
    });

    expect(fhir.id).toBe('custom-id');
    expect(fhir.url).toBe('http://example.com/fhir/Questionnaire/test');
    expect(fhir.status).toBe('active');
    expect(fhir.publisher).toBe('Test Publisher');
    expect(fhir.subjectType).toContain('Patient');
  });
});

// ---------------------------------------------------------------------------
// Round-Trip
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('preserves basic structure through import → export', () => {
    const original: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      id: 'round-trip-test',
      status: 'active',
      title: 'Round Trip Test',
      item: [
        {
          linkId: 'name',
          text: 'Name',
          type: 'string',
          required: true,
        },
        {
          linkId: 'age',
          text: 'Age',
          type: 'integer',
        },
        {
          linkId: 'active',
          text: 'Is Active?',
          type: 'boolean',
        },
      ],
    };

    const form = importFromFhir(original);
    const exported = exportToFhir(form);

    expect(exported.id).toBe('round-trip-test');
    expect(exported.title).toBe('Round Trip Test');
    expect(exported.item).toHaveLength(3);

    expect(exported.item?.[0].linkId).toBe('name');
    expect(exported.item?.[0].type).toBe('string');
    expect(exported.item?.[0].required).toBe(true);

    expect(exported.item?.[1].linkId).toBe('age');
    // Note: integer becomes decimal unless we preserve original type
    expect(['decimal', 'integer']).toContain(exported.item?.[1].type);

    expect(exported.item?.[2].linkId).toBe('active');
    expect(exported.item?.[2].type).toBe('boolean');
  });

  it('preserves choice options through round-trip', () => {
    const original: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          linkId: 'color',
          text: 'Favorite Color',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'red', display: 'Red' } },
            { valueCoding: { code: 'blue', display: 'Blue' } },
            { valueCoding: { code: 'green', display: 'Green' } },
          ],
        },
      ],
    };

    const form = importFromFhir(original);
    const exported = exportToFhir(form);

    expect(exported.item?.[0].answerOption).toHaveLength(3);
    expect(exported.item?.[0].answerOption?.[0].valueCoding?.code).toBe('red');
    expect(exported.item?.[0].answerOption?.[1].valueCoding?.code).toBe('blue');
    expect(exported.item?.[0].answerOption?.[2].valueCoding?.code).toBe(
      'green'
    );
  });
});

// ---------------------------------------------------------------------------
// Response Import
// ---------------------------------------------------------------------------

describe('importResponseFromFhir', () => {
  it('imports simple response answers', () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'http://example.com/Questionnaire/test',
      status: 'completed',
      item: [
        {
          linkId: 'name',
          answer: [{ valueString: 'John Doe' }],
        },
        {
          linkId: 'age',
          answer: [{ valueInteger: 30 }],
        },
        {
          linkId: 'active',
          answer: [{ valueBoolean: true }],
        },
      ],
    };

    const answers = importResponseFromFhir(response);

    expect(answers.name).toBe('John Doe');
    expect(answers.age).toBe(30);
    expect(answers.active).toBe(true);
  });

  it('imports coding answers as code values', () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'test',
      status: 'completed',
      item: [
        {
          linkId: 'gender',
          answer: [{ valueCoding: { code: 'male', display: 'Male' } }],
        },
      ],
    };

    const answers = importResponseFromFhir(response);

    expect(answers.gender).toBe('male');
  });

  it('imports multiple answers as array', () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'test',
      status: 'completed',
      item: [
        {
          linkId: 'colors',
          answer: [
            { valueCoding: { code: 'red' } },
            { valueCoding: { code: 'blue' } },
          ],
        },
      ],
    };

    const answers = importResponseFromFhir(response);

    expect(answers.colors).toEqual(['red', 'blue']);
  });

  it('imports nested response items', () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'test',
      status: 'completed',
      item: [
        {
          linkId: 'section1',
          item: [
            {
              linkId: 'nested-q',
              answer: [{ valueString: 'nested answer' }],
            },
          ],
        },
      ],
    };

    const answers = importResponseFromFhir(response);

    expect(answers['nested-q']).toBe('nested answer');
  });
});

// ---------------------------------------------------------------------------
// Response Export
// ---------------------------------------------------------------------------

describe('exportResponseToFhir', () => {
  it('exports simple answers to response', () => {
    const form = {
      id: 'test',
      fields: [
        { id: 'name', fieldType: 'text' as const, question: 'Name' },
        { id: 'age', fieldType: 'text' as const, inputType: 'number' as const },
        { id: 'active', fieldType: 'boolean' as const },
      ],
    };

    const answers = {
      name: 'John Doe',
      age: 30,
      active: true,
    };

    const response = exportResponseToFhir(form, answers, {
      questionnaireUrl: 'http://example.com/Questionnaire/test',
    });

    expect(response.resourceType).toBe('QuestionnaireResponse');
    expect(response.questionnaire).toBe(
      'http://example.com/Questionnaire/test'
    );
    expect(response.status).toBe('completed');
    expect(response.item).toHaveLength(3);

    expect(response.item?.[0].answer?.[0].valueString).toBe('John Doe');
    expect(response.item?.[1].answer?.[0].valueDecimal).toBe(30);
    expect(response.item?.[2].answer?.[0].valueBoolean).toBe(true);
  });

  it('exports choice answers with valueCoding', () => {
    const form = {
      id: 'test',
      fields: [
        {
          id: 'gender',
          fieldType: 'radio' as const,
          options: [
            { id: 'male', value: 'male', text: 'Male' },
            { id: 'female', value: 'female', text: 'Female' },
          ],
        },
      ],
    };

    const answers = { gender: 'male' };

    const response = exportResponseToFhir(form, answers, {
      questionnaireUrl: 'test',
    });

    expect(response.item?.[0].answer?.[0].valueCoding?.code).toBe('male');
    expect(response.item?.[0].answer?.[0].valueCoding?.display).toBe('Male');
  });

  it('exports multiple selections as multiple answers', () => {
    const form = {
      id: 'test',
      fields: [
        {
          id: 'colors',
          fieldType: 'check' as const,
          options: [
            { id: 'red', value: 'red', text: 'Red' },
            { id: 'blue', value: 'blue', text: 'Blue' },
            { id: 'green', value: 'green', text: 'Green' },
          ],
        },
      ],
    };

    const answers = { colors: ['red', 'blue'] };

    const response = exportResponseToFhir(form, answers, {
      questionnaireUrl: 'test',
    });

    expect(response.item?.[0].answer).toHaveLength(2);
    expect(response.item?.[0].answer?.[0].valueCoding?.code).toBe('red');
    expect(response.item?.[0].answer?.[1].valueCoding?.code).toBe('blue');
  });

  it('skips fields with no answer', () => {
    const form = {
      id: 'test',
      fields: [
        { id: 'q1', fieldType: 'text' as const },
        { id: 'q2', fieldType: 'text' as const },
      ],
    };

    const answers = { q1: 'answer1' };

    const response = exportResponseToFhir(form, answers, {
      questionnaireUrl: 'test',
    });

    expect(response.item).toHaveLength(1);
    expect(response.item?.[0].linkId).toBe('q1');
  });

  it('applies response options', () => {
    const form = { id: 'test', fields: [] };

    const response = exportResponseToFhir(
      form,
      {},
      {
        questionnaireUrl: 'http://example.com/Q/test',
        resourceId: 'response-123',
        status: 'in-progress',
        subject: { reference: 'Patient/123' },
        author: { reference: 'Practitioner/456' },
      }
    );

    expect(response.id).toBe('response-123');
    expect(response.status).toBe('in-progress');
    expect(response.subject?.reference).toBe('Patient/123');
    expect(response.author?.reference).toBe('Practitioner/456');
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty questionnaire', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
    };

    const form = importFromFhir(fhir);

    expect(form.fields).toHaveLength(0);
    expect(form.id).toBeTruthy(); // Should generate an ID
  });

  it('handles questionnaire with no item array', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: undefined,
    };

    const form = importFromFhir(fhir);

    expect(form.fields).toHaveLength(0);
  });

  it('handles deeply nested sections', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          linkId: 'level1',
          type: 'group',
          text: 'Level 1',
          item: [
            {
              linkId: 'level2',
              type: 'group',
              text: 'Level 2',
              item: [
                {
                  linkId: 'level3',
                  type: 'string',
                  text: 'Deep Question',
                },
              ],
            },
          ],
        },
      ],
    };

    const form = importFromFhir(fhir);
    const level1 = form.fields[0];

    expect(level1.fieldType).toBe('section');
    if (level1.fieldType === 'section') {
      const level2 = level1.fields?.[0];
      expect(level2?.fieldType).toBe('section');
      if (level2?.fieldType === 'section') {
        expect(level2.fields?.[0].id).toBe('level3');
      }
    }
  });

  it('adds warning for answerValueSet reference and preserves URL', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          linkId: 'q1',
          type: 'choice',
          answerValueSet: 'http://example.com/ValueSet/test',
        },
      ],
    };

    const form = importFromFhir(fhir);
    const meta = form._sourceData as { _conversionWarnings?: unknown[] };

    expect(meta._conversionWarnings).toBeDefined();
    expect(meta._conversionWarnings).toHaveLength(1);

    // Verify answerValueSet URL is preserved in field's _sourceData
    const fieldMeta = form.fields[0]._sourceData as { answerValueSet?: string };
    expect(fieldMeta.answerValueSet).toBe('http://example.com/ValueSet/test');
  });

  it('handles enableWhen with multiple conditions', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        { linkId: 'q1', type: 'boolean' },
        { linkId: 'q2', type: 'integer' },
        {
          linkId: 'q3',
          type: 'string',
          enableWhen: [
            { question: 'q1', operator: '=', answerBoolean: true },
            { question: 'q2', operator: '>', answerInteger: 10 },
          ],
          enableBehavior: 'all',
        },
      ],
    };

    const form = importFromFhir(fhir);
    const q3 = form.fields[2];

    expect(q3.rules?.[0].conditions).toHaveLength(2);
    expect(q3.rules?.[0].logic).toBe('AND');
  });

  it('handles enableWhen with any behavior', () => {
    const fhir: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        { linkId: 'q1', type: 'boolean' },
        { linkId: 'q2', type: 'boolean' },
        {
          linkId: 'q3',
          type: 'string',
          enableWhen: [
            { question: 'q1', operator: '=', answerBoolean: true },
            { question: 'q2', operator: '=', answerBoolean: true },
          ],
          enableBehavior: 'any',
        },
      ],
    };

    const form = importFromFhir(fhir);
    const q3 = form.fields[2];

    expect(q3.rules?.[0].logic).toBe('OR');
  });
});
