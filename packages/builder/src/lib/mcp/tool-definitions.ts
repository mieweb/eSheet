export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const BUILDER_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_form_summary',
      description:
        'CALL THIS FIRST before any edits. Returns all field IDs, fieldTypes, and questions. You must know a field\'s fieldType before choosing which edit tool to use (add_option vs add_column/add_row depends on fieldType).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fill_field',
      description:
        'Set a response in preview mode. For singlematrix fields, call once per row passing value as {"row label": "column label"} — do NOT pass all rows in one call.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          value: {},
        },
        required: ['value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_responses',
      description: 'Clear all responses.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_responses',
      description: 'Get current response values.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reset_form',
      description: 'Clear all fields.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_field',
      description:
        'Add one field. fieldType: text|longtext|radio|check|boolean|dropdown|multiselectdropdown|rating|ranking|slider|section|html|display|image|signature|diagram. properties: {inputType,unit,min,max,step}. Pass parentId to place the field directly inside a section. For "html" fields: set properties.htmlContent to a raw HTML string (e.g. "<p>Your message</p>") — do NOT use "question". For "display" fields: set properties.content to a markdown/formula string that may embed field values using {fieldId} syntax (e.g. "Your score is **{score-field}**") — do NOT use "question". For "section" fields: use properties.title instead of question.',
      parameters: {
        type: 'object',
        properties: {
          fieldType: { type: 'string' },
          question: { type: 'string' },
          required: { type: 'boolean' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
            },
          },
          afterFieldId: { type: 'string' },
          parentId: {
            type: 'string',
            description: 'ID of a section field to place this field inside.',
          },
          properties: { type: 'object', additionalProperties: true },
        },
        required: ['fieldType', 'question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_field',
      description:
        'Change scalar field properties (question, required, inputType, min, max, step, placeholder). Do NOT pass rows or columns here — use add_row/add_column instead. Identify by fieldQuestion or fieldId.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          updates: { type: 'object', additionalProperties: true },
        },
        required: ['updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_field',
      description: 'Delete a field by fieldQuestion or fieldId.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_option',
      description:
        'Add an option to a radio, check, boolean, dropdown, multiselectdropdown, rating, ranking, slider, or multitext field. NOT for singlematrix/multimatrix — those use add_column or add_row. If you are unsure of the field type, call get_form_summary first.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_option',
      description:
        'Update the label of an existing option on radio, check, dropdown, etc. NOT for singlematrix/multimatrix — use update_column or update_row instead. If you are unsure of the field type, call get_form_summary first. Use optionId from get_field, or currentValue to match by current label.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          optionId: { type: 'string' },
          currentValue: {
            type: 'string',
            description: 'Current label to match if optionId unknown',
          },
          value: { type: 'string' },
        },
        required: ['value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_option',
      description:
        'Remove an option from a radio, check, dropdown, etc. by its ID or current label. NOT for singlematrix/multimatrix — use remove_column or remove_row instead. If you are unsure of the field type, call get_form_summary first.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          optionId: { type: 'string' },
          currentValue: {
            type: 'string',
            description: 'Current label to match if optionId unknown',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_field',
      description:
        'Get full details of one field including its options/rows/columns with their IDs.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_field',
      description:
        'Reorder a field to a new index position (0-based). Use get_form_summary to see current order.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          toIndex: { type: 'number', description: '0-based target position' },
          toParentId: {
            type: 'string',
            description: 'Parent section ID, or omit for root',
          },
        },
        required: ['toIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_row',
      description: 'Add a row to a matrix field (singlematrix/multimatrix).',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_row',
      description:
        'Update a matrix row label. Use rowId from get_field, or currentValue to match by current label.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          rowId: { type: 'string' },
          currentValue: {
            type: 'string',
            description: 'Current label to match if rowId unknown',
          },
          value: { type: 'string' },
        },
        required: ['value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_row',
      description: 'Remove a matrix row by its ID.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          rowId: { type: 'string' },
        },
        required: ['rowId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_column',
      description: 'Add a column to a matrix field.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_column',
      description:
        'Update a matrix column label. Use columnId from get_field, or currentValue to match by current label.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          columnId: { type: 'string' },
          currentValue: {
            type: 'string',
            description: 'Current label to match if columnId unknown',
          },
          value: { type: 'string' },
        },
        required: ['value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_column',
      description: 'Remove a matrix column by its ID.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          columnId: { type: 'string' },
        },
        required: ['columnId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_field_types',
      description:
        'List all available field types with their key, label, category, and whether they support options or matrix rows/columns. Call this before create_field if unsure which fieldType to use.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_field_spec',
      description:
        'Get the full spec for a specific field type: capabilities, default properties, and placeholder hints.',
      parameters: {
        type: 'object',
        properties: {
          fieldType: { type: 'string', description: 'The field type key, e.g. "radio", "slider", "singlematrix"' },
        },
        required: ['fieldType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_definition',
      description:
        'Export the complete current form as a JSON definition tree — all fields, options, rows, columns, and logic rules. Use this to inspect the full form structure or to verify logic rules on any field.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_field_rule',
      description:
        'Add a conditional logic rule to a field based on another field\'s response. Controls whether this field is visible, enabled, or required. effect: "visible"|"enable"|"required". logic: "AND"|"OR". Each condition: { targetId, operator, expected }. For option-based fields (radio, check, dropdown, etc.), expected must be the option ID (e.g. "o1") — use get_field to look up IDs. Operators: equals|notEquals|contains|includes|empty|notEmpty|greaterThan|greaterThanOrEqual|lessThan|lessThanOrEqual. Use "includes" for multi-select fields (check, multiselectdropdown, ranking). Use "empty"/"notEmpty" with no expected value.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          effect: {
            type: 'string',
            enum: ['visible', 'enable', 'required'],
          },
          logic: {
            type: 'string',
            enum: ['AND', 'OR'],
          },
          conditions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                targetId: { type: 'string', description: 'Field ID whose response is checked.' },
                operator: { type: 'string', description: 'equals|notEquals|contains|includes|empty|notEmpty|greaterThan|greaterThanOrEqual|lessThan|lessThanOrEqual' },
                expected: { type: 'string', description: 'For option-based fields use the option ID (e.g. "o1"), not the label. Omit for empty/notEmpty.' },
              },
              required: ['targetId', 'operator'],
            },
          },
        },
        required: ['effect', 'logic', 'conditions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_expression_rule',
      description:
        'Add a conditional logic rule to a field using a custom expression. Use this for complex conditions that field-based rules cannot express (e.g. arithmetic, multi-field combinations). The expression is evaluated in a safe sandbox — NOT full JavaScript. CRITICAL SYNTAX: field IDs MUST be wrapped in curly braces: {fieldId}. Example: `{text-3} > 4 && {rating-1} < 3`. Available operators: +,-,*,/,%, comparisons (==,!=,===,!==,>,>=,<,<=), logical (&&,||,!), property access (.length, .count on field refs). NOT available: ANY function calls (parseInt, parseFloat, Object.values, .includes, .find, .filter, etc.), bare field names without {}, loops, or assignments. NEVER use parseInt() — text fields with inputType "number" and rating/slider fields already resolve to numbers automatically, use them directly. Field values in expressions: text/longtext with inputType "number" → number. text/longtext otherwise → string. radio/dropdown/boolean/slider/rating → option label string (NOT id). check/multiselectdropdown/ranking → array of option label strings (use .count for length). singlematrix/multimatrix → object keyed by rowId (use .count for answered row count). Valid examples: `{f1} > 4 && {f2} < 3`, `{f3}.length > 0`, `{f4} == "Yes"`. Invalid: `parseInt({f1}) > 4`, `f1 > 4` (missing braces).',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          effect: {
            type: 'string',
            enum: ['visible', 'enable', 'required'],
          },
          expression: {
            type: 'string',
            description: 'Expression string. Use field IDs as variable names. No method calls allowed.',
          },
        },
        required: ['effect', 'expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_rule',
      description:
        'Remove a conditional logic rule from a field by its 0-based index. Use get_field or get_definition to see existing rules and their indices.',
      parameters: {
        type: 'object',
        properties: {
          fieldQuestion: { type: 'string' },
          fieldId: { type: 'string' },
          ruleIndex: { type: 'number', description: '0-based index of the rule to remove.' },
        },
        required: ['ruleIndex'],
      },
    },
  },
];
