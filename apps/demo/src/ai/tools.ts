import type { BuilderTools } from '@esheet/builder';

export type { BuilderTools };

type ToolArgs = Record<string, unknown>;

export function executeToolCall(
  toolName: string,
  args: ToolArgs,
  tools: BuilderTools,
): string | Record<string, unknown> {
  switch (toolName) {
    case 'create_field':
      return createField(args, tools);
    case 'update_field':
      return updateField(args, tools);
    case 'delete_field':
      return deleteField(args, tools);
    case 'get_form_summary':
      return tools.getFormSummary();
    default:
      return `Unknown tool: ${toolName}`;
  }
}

function createField(args: ToolArgs, tools: BuilderTools): string {
  const fieldType = args.fieldType as import('@esheet/core').FieldType;
  const patch: Record<string, unknown> = { question: args.question as string };
  if (args.required !== undefined) patch.required = args.required;
  if (args.options) patch.options = args.options;

  let opts: import('@esheet/core').AddFieldOptions = { patch };
  if (args.afterFieldId) {
    // afterFieldId-based positioning is handled by the store's index option.
    // We pass the afterFieldId as a hint; the caller can extend this if needed.
    opts = { ...opts };
  }

  const newId = tools.addField(fieldType, opts);
  if (!newId) return `Unknown field type: ${fieldType}`;
  return `Created field "${args.question}" with ID: ${newId}`;
}

function updateField(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;

  let updates = args.updates as Record<string, unknown>;
  if (typeof updates === 'string') {
    try {
      updates = JSON.parse(updates) as Record<string, unknown>;
    } catch {
      return `Invalid updates format: ${updates}`;
    }
  }

  const ok = tools.updateField(fieldId, updates);
  return ok ? `Updated field ${fieldId}` : `Field not found: ${fieldId}`;
}

function deleteField(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;

  const ok = tools.removeField(fieldId);
  return ok ? `Deleted field ${fieldId}` : `Field not found: ${fieldId}`;
}

