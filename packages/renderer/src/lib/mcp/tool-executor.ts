import type { RendererTools } from '../renderer-tools.js';

type ToolArgs = Record<string, unknown>;

export function executeToolCall(
  toolName: string,
  args: ToolArgs,
  tools: RendererTools
): string | Record<string, unknown> {
  switch (toolName) {
    case 'get_form':
      return tools.getForm();
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
  return {
    result: `Field "${fieldId}" updated`,
    currentVisibleFields: form.fields,
  };
}
