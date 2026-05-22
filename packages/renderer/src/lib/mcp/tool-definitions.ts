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
        'Returns visible fields split into filled vs unfilled. Response: {formId, totalFields, filledCount, unfilledFields (full details), filledFieldIds (just IDs)}. Use unfilledFields to see what needs filling.\n\nFILL LOOP PATTERN:\n1. Call get_form — fill every field in unfilledFields using fill_field.\n2. Call get_form again. If new fields appeared in unfilledFields (revealed by conditional logic), fill those too.\n3. Repeat until unfilledFields is empty.\n\nNever assume you are done after a single pass — conditional logic frequently reveals new fields.',
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
        'Set a response value for ONE visible field. Returns { result, filledCount, unfilledFields } where unfilledFields contains ONLY the fields still needing values (with full details including options/valueFormat). You are done when unfilledFields is empty.\n\nField type rules:\n- radio/dropdown/boolean/rating/slider: pass a single string matching one of the options values\n- check/multiselectdropdown: pass an array of strings matching option values\n- ranking: pass an ordered array of option value strings representing the desired rank order\n- multitext: pass an array of strings, one per option slot in order\n- singlematrix: pass an object { "Row Label": "Column Label" } for each row\n- multimatrix: pass an object { "Row Label": ["Col1", "Col2"] } for each row\n- text: use the valueFormat from the field\'s schema (e.g. YYYY-MM-DD for date, YYYY-MM-DDTHH:mm for datetime-local, YYYY-MM for month, HH:mm for time). Wrong formats are rejected with an error.',
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
