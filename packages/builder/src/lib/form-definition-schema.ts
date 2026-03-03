/**
 * JSON Schema for the MIE Forms FormDefinition type.
 *
 * Used by Monaco (JSON mode) and monaco-yaml (YAML mode) to provide
 * autocomplete, validation, and hover documentation in the Code View.
 *
 * Keep in sync with `@msheet/core` types (types.ts).
 */

const fieldTypes = [
  'text',
  'longtext',
  'multitext',
  'radio',
  'check',
  'boolean',
  'dropdown',
  'multiselectdropdown',
  'rating',
  'ranking',
  'slider',
  'singlematrix',
  'multimatrix',
  'image',
  'html',
  'signature',
  'diagram',
  'expression',
  'section',
] as const;

const textInputTypes = [
  'string',
  'number',
  'email',
  'tel',
  'date',
  'datetime-local',
  'month',
  'time',
  'url',
] as const;

const expressionDisplayFormats = [
  'number',
  'currency',
  'percentage',
  'boolean',
  'string',
] as const;

const conditionOperators = [
  'equals',
  'notEquals',
  'contains',
  'includes',
  'empty',
  'notEmpty',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
] as const;

// ---------------------------------------------------------------------------
// Schema (JSON Schema Draft-07)
// ---------------------------------------------------------------------------

export const formDefinitionSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'FormDefinition',
  description: 'MIE Forms form definition schema (mieforms-v1.0).',
  type: 'object',
  required: ['schemaType', 'fields'],
  additionalProperties: false,
  properties: {
    schemaType: {
      type: 'string',
      const: 'mieforms-v1.0',
      description: 'Schema version identifier. Must be "mieforms-v1.0".',
    },
    title: {
      type: 'string',
      description: 'Form title.',
    },
    description: {
      type: 'string',
      description: 'Form description.',
    },
    fields: {
      type: 'array',
      description: 'Ordered list of top-level fields.',
      items: { $ref: '#/definitions/FieldDefinition' },
    },
  },

  definitions: {
    FieldDefinition: {
      type: 'object',
      description: 'A form field definition.',
      required: ['id', 'fieldType'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier within the form.',
        },
        fieldType: {
          type: 'string',
          enum: [...fieldTypes],
          description: 'Determines rendering and behavior.',
        },
        question: {
          type: 'string',
          description: 'The question / label shown to the user.',
        },
        required: {
          type: 'boolean',
          description:
            'Whether a response is required (can be overridden by a conditional rule).',
        },
        rules: {
          type: 'array',
          description:
            'Conditional rules that control visibility, enabled state, or required state.',
          items: { $ref: '#/definitions/ConditionalRule' },
        },

        // --- Text fields ---
        inputType: {
          type: 'string',
          enum: [...textInputTypes],
          description: 'HTML input type variant (text field only).',
        },
        unit: {
          type: 'string',
          description: 'Unit label shown beside the input (text field only).',
        },

        // --- Choice fields ---
        options: {
          type: 'array',
          description: 'Available options to choose from.',
          items: { $ref: '#/definitions/FieldOption' },
        },

        // --- Matrix fields ---
        rows: {
          type: 'array',
          description: 'Row definitions for matrix fields.',
          items: { $ref: '#/definitions/MatrixRow' },
        },
        columns: {
          type: 'array',
          description: 'Column definitions for matrix fields.',
          items: { $ref: '#/definitions/MatrixColumn' },
        },

        // --- Rich content ---
        htmlContent: {
          type: 'string',
          description: 'Raw HTML content (html field).',
        },
        imageUri: {
          type: 'string',
          description: 'Image URI (image field).',
        },

        // --- Expression fields ---
        expression: {
          type: 'string',
          description: 'Expression formula, e.g. "{field1} + {field2}".',
        },
        displayFormat: {
          type: 'string',
          enum: [...expressionDisplayFormats],
          description: 'How the expression result is formatted.',
        },
        decimalPlaces: {
          type: 'integer',
          minimum: 0,
          description: 'Number of decimal places for numeric formats.',
        },

        // --- Section (container) ---
        title: {
          type: 'string',
          description: 'Section title (used instead of question).',
        },
        fields: {
          type: 'array',
          description: 'Nested child fields (section only).',
          items: { $ref: '#/definitions/FieldDefinition' },
        },
      },
    },

    FieldOption: {
      type: 'object',
      description: 'A selectable option in a choice field.',
      required: ['id', 'value'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Unique option identifier.' },
        value: { type: 'string', description: 'Display text / value.' },
        text: {
          type: 'string',
          description: 'Optional separate display text.',
        },
      },
    },

    MatrixRow: {
      type: 'object',
      description: 'A row in a matrix field.',
      required: ['id', 'value'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Unique row identifier.' },
        value: { type: 'string', description: 'Row label.' },
      },
    },

    MatrixColumn: {
      type: 'object',
      description: 'A column in a matrix field.',
      required: ['id', 'value'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Unique column identifier.' },
        value: { type: 'string', description: 'Column label.' },
      },
    },

    Condition: {
      type: 'object',
      description:
        "A single condition that evaluates a target field's response.",
      required: ['targetId', 'operator', 'expected'],
      additionalProperties: false,
      properties: {
        targetId: {
          type: 'string',
          description: 'The field ID whose response is evaluated.',
        },
        operator: {
          type: 'string',
          enum: [...conditionOperators],
          description: 'Comparison operator.',
        },
        expected: {
          type: 'string',
          description: 'The expected value to compare against.',
        },
        propertyAccessor: {
          type: 'string',
          description: "Optional property accessor (e.g. 'length', 'count').",
        },
      },
    },

    ConditionalRule: {
      type: 'object',
      description:
        "A conditional rule that controls a field's behavior based on other fields' responses.",
      required: ['effect', 'logic', 'conditions'],
      additionalProperties: false,
      properties: {
        effect: {
          type: 'string',
          enum: ['visible', 'enable', 'required'],
          description: 'What effect this rule has on the field.',
        },
        logic: {
          type: 'string',
          enum: ['AND', 'OR'],
          description: 'How multiple conditions are combined.',
        },
        conditions: {
          type: 'array',
          description: 'One or more conditions to evaluate.',
          items: { $ref: '#/definitions/Condition' },
          minItems: 1,
        },
      },
    },
  },
} as const;

/** URI used to register the schema with Monaco / monaco-yaml. */
export const FORM_SCHEMA_URI = 'inmemory://msheet/form-definition.schema.json';
