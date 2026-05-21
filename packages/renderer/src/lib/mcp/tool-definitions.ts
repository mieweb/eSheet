export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const RENDERER_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_form',
      description:
        'Returns only the currently VISIBLE fillable fields with their IDs, fieldTypes, questions, available option values, inputType, valueFormat (for structured input types), and hasValue (true = already filled, false = still empty). Fields hidden by conditional logic are excluded.\n\nFILL LOOP PATTERN — you MUST follow this every time:\n1. Call get_form to get the current visible fields.\n2. Fill every field where hasValue is false using fill_field.\n3. Call get_form again. If any fields now have hasValue false that were not previously visible, fill those too.\n4. Repeat until every visible field has hasValue true.\n\nNever assume you are done after a single pass — conditional logic frequently reveals new fields after a selection is made.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_form_raw',
      description:
        'Returns ALL fields in the form regardless of visibility, conditional rules, or enabled state. Use this to see the full form schema.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_responses',
      description: 'Get the current raw response values for all fields.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_valid_response',
      description:
        'Run form validation. Returns the full response object if all required fields pass, or null plus field-level errors if validation fails. Call this before submitting.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fill_field',
      description:
        'Set a response value for ONE visible field. Returns { result, currentVisibleFields } where currentVisibleFields is the updated list of visible fields after the fill, each with a hasValue flag. Always check currentVisibleFields for any fields where hasValue is false — those are still empty and must be filled before finishing.\n\nField type rules:\n- radio/dropdown/boolean/rating/slider: pass a single string matching one of the options values\n- check/multiselectdropdown: pass an array of strings matching option values\n- ranking: pass an ordered array of option value strings representing the desired rank order\n- multitext: pass an array of strings, one per option slot in order\n- singlematrix: pass an object { "Row Label": "Column Label" } for each row\n- multimatrix: pass an object { "Row Label": ["Col1", "Col2"] } for each row\n- text: use the valueFormat from the field\'s schema (e.g. YYYY-MM-DD for date, YYYY-MM-DDTHH:mm for datetime-local, YYYY-MM for month, HH:mm for time). Wrong formats are rejected with an error.',
      parameters: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          fieldQuestion: { type: 'string' },
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
      description: 'Clear all current form responses.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_form_tree',
      description:
        'Get the full rendered field tree including visibility, enabled, and required state for each field given current responses.',
      parameters: { type: 'object', properties: {} },
    },
  },
];
