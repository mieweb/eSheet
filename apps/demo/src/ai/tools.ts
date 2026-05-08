import type { FormDefinition, FieldType } from '@esheet/core';
import { generateFieldId } from '@esheet/core';

export interface ToolContext {
  getDefinition: () => FormDefinition;
  setDefinition: (def: FormDefinition) => void;
}

type ToolArgs = Record<string, unknown>;

export function executeToolCall(
  toolName: string,
  args: ToolArgs,
  ctx: ToolContext,
): string | Record<string, unknown> {
  switch (toolName) {
    case 'create_field':
      return createField(args, ctx);
    case 'update_field':
      return updateField(args, ctx);
    case 'delete_field':
      return deleteField(args, ctx);
    case 'get_form_summary':
      return getFormSummary(ctx);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

function createField(args: ToolArgs, ctx: ToolContext): string {
  const def = ctx.getDefinition();
  const existingIds = new Set(def.fields.map((f) => f.id));
  const fieldType = args.fieldType as FieldType;
  const newField: Record<string, unknown> = {
    id: generateFieldId(fieldType, existingIds),
    fieldType,
    question: args.question as string,
  };
  if (args.required !== undefined) newField.required = args.required;
  if (args.options) newField.options = args.options;

  let fields = [...def.fields];
  if (args.afterFieldId) {
    const idx = fields.findIndex((f) => f.id === args.afterFieldId);
    if (idx >= 0) {
      fields.splice(idx + 1, 0, newField as (typeof fields)[number]);
    } else {
      fields.push(newField as (typeof fields)[number]);
    }
  } else {
    fields.push(newField as (typeof fields)[number]);
  }

  ctx.setDefinition({ ...def, fields });
  return `Created field "${args.question}" with ID: ${newField.id}`;
}

function resolveFieldIndex(
  args: ToolArgs,
  fields: FormDefinition['fields'],
): number {
  if (args.fieldId) {
    return fields.findIndex((f) => f.id === (args.fieldId as string));
  }
  if (args.fieldQuestion) {
    const q = (args.fieldQuestion as string).toLowerCase();
    return fields.findIndex((f) =>
      f.question?.toLowerCase().includes(q),
    );
  }
  return -1;
}

function updateField(args: ToolArgs, ctx: ToolContext): string {
  const def = ctx.getDefinition();
  const idx = resolveFieldIndex(args, def.fields);
  if (idx < 0)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;

  let updates = args.updates as Record<string, unknown>;
  // Defensively parse if the model passed updates as a JSON string
  if (typeof updates === 'string') {
    try {
      updates = JSON.parse(updates) as Record<string, unknown>;
    } catch {
      return `Invalid updates format: ${updates}`;
    }
  }
  const updatedFields = [...def.fields];
  updatedFields[idx] = { ...updatedFields[idx], ...updates };
  ctx.setDefinition({ ...def, fields: updatedFields });
  return `Updated field ${def.fields[idx].id}`;
}

function deleteField(args: ToolArgs, ctx: ToolContext): string {
  const def = ctx.getDefinition();
  const idx = resolveFieldIndex(args, def.fields);
  if (idx < 0)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;

  const removedId = def.fields[idx].id;
  const fields = def.fields.filter((_, i) => i !== idx);
  ctx.setDefinition({ ...def, fields });
  return `Deleted field ${removedId}`;
}

function getFormSummary(ctx: ToolContext): Record<string, unknown> {
  const def = ctx.getDefinition();
  return {
    formId: def.id,
    fieldCount: def.fields.length,
    fields: def.fields.map((field) => ({
      id: field.id,
      fieldType: field.fieldType,
      question: field.question,
      required: field.required ?? false,
      optionCount: (field as { options?: unknown[] }).options?.length ?? 0,
    })),
  };
}
