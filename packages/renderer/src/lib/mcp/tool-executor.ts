import type { RendererTools } from '../renderer-tools.js';

type ToolArgs = Record<string, unknown>;

export function executeToolCall(
  toolName: string,
  args: ToolArgs,
  tools: RendererTools
): string | Record<string, unknown> {
  switch (toolName) {
    case 'get_form':
      return getFormOptimized(tools);
    case 'get_form_raw':
      return tools.getFormRaw();
    case 'get_responses':
      return tools.getResponses();
    case 'get_valid_response':
      return tools.getValidResponse() as unknown as Record<string, unknown>;
    case 'fill_field':
      return fillField(args, tools);
    case 'clear_responses':
      tools.clearResponses();
      return 'Responses cleared';
    case 'get_form_tree':
      return { fields: tools.getFormTree() };
    default:
      return `Unknown tool: ${toolName}`;
  }
}

/** Optimized get_form: returns full details only for unfilled fields to reduce token usage. */
function getFormOptimized(tools: RendererTools): Record<string, unknown> {
  const form = tools.getForm();
  const filledFields = form.fields.filter((f) => f.hasValue);
  const unfilledFields = form.fields.filter((f) => !f.hasValue);
  return {
    formId: form.formId,
    totalFields: form.fieldCount,
    filledCount: filledFields.length,
    // Only unfilled fields need full details (options, questions, etc.)
    unfilledFields,
    // Filled fields: just IDs for reference
    filledFieldIds: filledFields.map((f) => f.id),
  };
}

function fillField(
  args: ToolArgs,
  tools: RendererTools
): string | Record<string, unknown> {
  const fieldId = tools.resolveFieldId(
    args['fieldId'] as string | undefined,
    args['fieldQuestion'] as string | undefined
  );
  if (!fieldId)
    return 'Error: field not found — provide fieldId or fieldQuestion';
  const result = tools.fillField(fieldId, args['value']);
  if (typeof result === 'string') return result; // format validation error
  if (!result)
    return `Error: field "${fieldId}" is not currently visible — call get_form to see the current visible fields`;
  const form = tools.getForm();
  // Return only unfilled fields with full details (token optimization)
  const filledFields = form.fields.filter((f) => f.hasValue);
  const unfilledFields = form.fields.filter((f) => !f.hasValue);
  return {
    result: `Field "${fieldId}" updated`,
    filledCount: filledFields.length,
    unfilledFields,
  };
}
