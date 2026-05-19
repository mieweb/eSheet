import type { BuilderTools } from '../builder-tools.js';

type FieldType = Parameters<BuilderTools['addField']>[0];
type AddFieldOptions = NonNullable<Parameters<BuilderTools['addField']>[1]>;

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
    case 'reset_form':
      return resetForm(args, tools);
    case 'generate_form':
      return generateForm(args, tools);
    case 'get_form_summary':
      return tools.getFormSummary();
    case 'fill_field':
      return fillField(args, tools);
    case 'clear_responses':
      tools.clearResponses();
      return 'Responses cleared';
    case 'get_responses':
      return tools.getResponses();
    case 'add_option':
      return addOption(args, tools);
    case 'update_option':
      return updateOption(args, tools);
    case 'remove_option':
      return removeOption(args, tools);
    case 'get_field':
      return getFieldDetail(args, tools);
    case 'move_field':
      return moveField(args, tools);
    case 'add_row':
      return addRow(args, tools);
    case 'update_row':
      return updateRow(args, tools);
    case 'remove_row':
      return removeRow(args, tools);
    case 'add_column':
      return addColumn(args, tools);
    case 'update_column':
      return updateColumn(args, tools);
    case 'remove_column':
      return removeColumn(args, tools);
    case 'get_field_types':
      return { fieldTypes: tools.getFieldTypes() };
    case 'get_field_spec':
      return getFieldSpec(args, tools);
    case 'get_definition':
      return tools.getDefinition() as unknown as Record<string, unknown>;
    case 'add_field_rule':
      return addFieldRule(args, tools);
    case 'add_expression_rule':
      return addExpressionRule(args, tools);
    case 'remove_rule':
      return removeRule(args, tools);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

const PLACEHOLDER_IDS = new Set(['q1', 'q2', 'q3']);

function createField(args: ToolArgs, tools: BuilderTools): string {
  // Auto-clear placeholder fields on first AI-created field.
  const { fields } = tools.getFormSummary();
  if (
    fields.length > 0 &&
    fields.every((f) => PLACEHOLDER_IDS.has(f.id))
  ) {
    tools.resetForm({ id: 'form-1', fields: [] });
  }

  const fieldType = args.fieldType as FieldType;
  const patch: Record<string, unknown> = { question: args.question as string };
  if (args.required !== undefined) patch.required = args.required;
  // Suppress auto-generated placeholder rows/columns on matrix fields so the
  // AI doesn't have to remove them — it will add exactly what it needs.
  if (fieldType === 'singlematrix' || fieldType === 'multimatrix') {
    patch.rows = [];
    patch.columns = [];
  }
  if (args.options) {
    const opts = args.options as unknown[];
    patch.options = opts.map((o, i) => {
      if (typeof o === 'string') return { id: `o${i + 1}`, value: o };
      const obj = o as { id?: string; value?: string };
      return { id: obj.id ?? `o${i + 1}`, value: obj.value ?? '' };
    });
  }

  if (args.properties && typeof args.properties === 'object')
    Object.assign(patch, args.properties as Record<string, unknown>);

  let opts: AddFieldOptions = { patch };
  if (args.parentId) {
    opts = { ...opts, parentId: args.parentId as string };
  }
  if (args.afterFieldId) {
    const { fields } = tools.getFormSummary();
    const afterIdx = fields.findIndex((f) => f.id === args.afterFieldId);
    if (afterIdx >= 0) opts = { ...opts, index: afterIdx + 1 };
  }

  const newId = tools.addField(fieldType, opts);
  if (!newId) return `Unknown field type: ${fieldType}`;
  return `Created field "${args.question}" with ID: ${newId}`;
}

function fillField(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;
  const ok = tools.fillField(fieldId, args.value);
  const summary = tools.getFormSummary();
  const field = summary.fields.find((f) => f.id === fieldId);
  const label = field?.question ?? fieldId;
  return ok
    ? `Filled "${label}" with ${JSON.stringify(args.value)}`
    : `Field not found: ${fieldId}`;
}

function generateForm(args: ToolArgs, tools: BuilderTools): string {
  const questions = args.questions as
    | {
        question: string;
        fieldType?: string;
        required?: boolean;
        inputType?: string;
      }[]
    | undefined;
  if (!Array.isArray(questions) || questions.length === 0)
    return `Missing 'questions' array — provide an array of { question, fieldType?, required?, inputType? }`;
  return tools.generateForm(questions.slice(0, 5));
}

function resetForm(_args: ToolArgs, tools: BuilderTools): string {
  tools.resetForm({ id: 'form-1', fields: [] });
  return 'Form cleared';
}

function updateField(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;

  let updates = args.updates as Record<string, unknown> | undefined;
  // Fallback: AI sometimes puts field props at the top level instead of inside `updates`.
  // Collect any known field properties from top-level args.
  if (updates === undefined || updates === null) {
    const FIELD_PROPS = [
      'question',
      'required',
      'inputType',
      'unit',
      'min',
      'max',
      'step',
      'options',
      'placeholder',
    ];
    const collected: Record<string, unknown> = {};
    for (const key of FIELD_PROPS) {
      if (args[key] !== undefined) collected[key] = args[key];
    }
    if (Object.keys(collected).length > 0) {
      updates = collected;
    } else {
      return `Missing 'updates' object. Pass the properties to change as an object, e.g. { "question": "New text" }`;
    }
  }
  if (typeof updates === 'string') {
    try {
      updates = JSON.parse(updates) as Record<string, unknown>;
    } catch {
      return `Invalid updates format: ${updates}`;
    }
  }

  // For options, use surgical add/remove instead of replacing the whole array.
  if (Array.isArray(updates['options'])) {
    const newOptions = updates['options'] as unknown[];
    const current = tools.getField(fieldId);
    const currentOptions =
      (
        current?.definition as
          | { options?: { id: string; value: string }[] }
          | undefined
      )?.options ?? [];

    // Remove options not in the new list.
    for (const existing of currentOptions) {
      const kept = newOptions.some(
        (o) =>
          (typeof o === 'string'
            ? o
            : (o as { value?: string }).value) === existing.value ||
          (o as { id?: string }).id === existing.id,
      );
      if (!kept) tools.option.remove(fieldId, existing.id);
    }

    // Add options not already present.
    for (const o of newOptions) {
      const value =
        typeof o === 'string' ? o : (o as { value?: string }).value ?? '';
      const alreadyExists = currentOptions.some((ex) => ex.value === value);
      if (!alreadyExists) tools.option.add(fieldId, value);
    }

    // Strip options from the patch so updateField doesn't clobber the store.
    const { options: _options, ...rest } = updates;
    void _options;
    updates = rest;
  }

  if (Object.keys(updates).length === 0) return `Updated field ${fieldId}`;
  if ('rows' in updates || 'columns' in updates)
    return `Cannot set rows/columns via update_field. Use add_row/add_column to add items one at a time.`;
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

function getFieldDetail(
  args: ToolArgs,
  tools: BuilderTools,
): Record<string, unknown> | string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;
  const node = tools.getField(fieldId);
  if (!node) return `Field not found: ${fieldId}`;
  const def = node.definition as Record<string, unknown>;
  return { id: fieldId, ...def };
}

function moveField(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;
  const toIndex = args.toIndex as number;
  if (typeof toIndex !== 'number') return `Missing 'toIndex' (number)`;
  const ok = tools.moveField(
    fieldId,
    toIndex,
    (args.toParentId as string | null | undefined) ?? null,
  );
  return ok ? `Moved field ${fieldId} to index ${toIndex}` : `Failed to move field ${fieldId}`;
}

function addRow(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  const fieldType = getFieldType(fieldId, tools);
  if (fieldType && !MATRIX_TYPES.has(fieldType))
    return `Field '${fieldId}' is a ${fieldType} field — rows only apply to singlematrix/multimatrix. Use add_option for option-based fields.`;
  const rowId = tools.row.add(fieldId, args.value as string | undefined);
  return rowId ? `Added row ${rowId}` : `Field not found or not a matrix field`;
}

function updateRow(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  let rowId = args.rowId as string | undefined;
  if (!rowId && args.value) {
    const node = tools.getField(fieldId);
    const rows =
      (node?.definition as { rows?: { id: string; value: string }[] } | undefined)
        ?.rows ?? [];
    const match = rows.find((r) => r.value === (args.currentValue as string));
    if (match) rowId = match.id;
  }
  if (!rowId) return `Missing 'rowId'`;
  const ok = tools.row.update(fieldId, rowId, args.value as string);
  return ok ? `Updated row ${rowId}` : `Row not found`;
}

function removeRow(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  const ok = tools.row.remove(fieldId, args.rowId as string);
  return ok ? `Removed row ${args.rowId as string}` : `Row not found`;
}

function addColumn(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  const fieldType = getFieldType(fieldId, tools);
  if (fieldType && !MATRIX_TYPES.has(fieldType))
    return `Field '${fieldId}' is a ${fieldType} field — columns only apply to singlematrix/multimatrix fields.`;
  const colId = tools.column.add(fieldId, args.value as string | undefined);
  return colId ? `Added column ${colId}` : `Field not found or not a matrix field`;
}

function updateColumn(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  let columnId = args.columnId as string | undefined;
  if (!columnId && args.value) {
    const node = tools.getField(fieldId);
    const cols =
      (node?.definition as { columns?: { id: string; value: string }[] } | undefined)
        ?.columns ?? [];
    const match = cols.find((c) => c.value === (args.currentValue as string));
    if (match) columnId = match.id;
  }
  if (!columnId) return `Missing 'columnId'`;
  const ok = tools.column.update(fieldId, columnId, args.value as string);
  return ok ? `Updated column ${columnId}` : `Column not found`;
}

function removeColumn(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  const ok = tools.column.remove(fieldId, args.columnId as string);
  return ok ? `Removed column ${args.columnId as string}` : `Column not found`;
}

function getFieldSpec(
  args: ToolArgs,
  tools: BuilderTools,
): Record<string, unknown> | string {
  const fieldType = args.fieldType as string | undefined;
  if (!fieldType) return `Missing 'fieldType'`;
  const spec = tools.getFieldSpec(fieldType);
  if (!spec) return `Unknown field type: ${fieldType}`;
  return spec as unknown as Record<string, unknown>;
}

const MATRIX_TYPES = new Set(['singlematrix', 'multimatrix']);
const OPTION_TYPES = new Set([
  'radio', 'check', 'boolean', 'dropdown', 'multiselectdropdown',
  'rating', 'ranking', 'slider', 'multitext',
]);

function getFieldType(fieldId: string, tools: BuilderTools): string | undefined {
  const node = tools.getField(fieldId);
  return (node?.definition as { fieldType?: string } | undefined)?.fieldType;
}

function addOption(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  const fieldType = getFieldType(fieldId, tools);
  if (fieldType && MATRIX_TYPES.has(fieldType))
    return `'${fieldId}' is a ${fieldType} field — use add_row/add_column, not add_option.`;
  if (fieldType && !OPTION_TYPES.has(fieldType))
    return `'${fieldId}' is a ${fieldType} field — it does not support options.`;
  const optId = tools.option.add(fieldId, args.value as string | undefined);
  return optId ? `Added option ${optId}` : `Field not found or not an option field`;
}

function updateOption(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  let optionId = args.optionId as string | undefined;
  // Allow resolving by current label if id not provided
  if (!optionId && args.currentValue) {
    const node = tools.getField(fieldId);
    const opts =
      (node?.definition as { options?: { id: string; value: string }[] } | undefined)
        ?.options ?? [];
    const match = opts.find((o) => o.value === (args.currentValue as string));
    if (match) optionId = match.id;
  }
  if (!optionId) return `Missing 'optionId' or 'currentValue' to identify option`;
  const ok = tools.option.update(fieldId, optionId, args.value as string);
  return ok ? `Updated option ${optionId}` : `Option not found`;
}

function removeOption(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;
  let optionId = args.optionId as string | undefined;
  if (!optionId && args.currentValue) {
    const node = tools.getField(fieldId);
    const opts =
      (node?.definition as { options?: { id: string; value: string }[] } | undefined)
        ?.options ?? [];
    const match = opts.find((o) => o.value === (args.currentValue as string));
    if (match) optionId = match.id;
  }
  if (!optionId) return `Missing 'optionId' or 'currentValue' to identify option`;
  const ok = tools.option.remove(fieldId, optionId);
  return ok ? `Removed option ${optionId}` : `Option not found`;
}

function addFieldRule(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;

  const effect = args.effect as string;
  const logic = (args.logic as string) ?? 'AND';
  const conditions = args.conditions as unknown[] | undefined;

  if (!effect) return `Missing 'effect' (visible|enable|required)`;
  if (!Array.isArray(conditions) || conditions.length === 0)
    return `Missing 'conditions' array`;

  const node = tools.getField(fieldId);
  if (!node) return `Field not found: ${fieldId}`;

  const mappedConditions = (conditions as Record<string, unknown>[]).map((c) => ({
    conditionType: 'field' as const,
    targetId: c['targetId'] as string,
    operator: c['operator'] as string,
    ...(c['expected'] !== undefined && { expected: c['expected'] as string }),
    ...(c['propertyAccessor'] !== undefined && { propertyAccessor: c['propertyAccessor'] as string }),
  }));

  const existing = (node.definition as { rules?: unknown[] }).rules ?? [];
  const newRule = { effect, logic, conditions: mappedConditions };
  const ok = tools.updateField(fieldId, { rules: [...existing, newRule] });
  return ok
    ? `Added ${effect} field rule (index ${existing.length}) to field ${fieldId}`
    : `Failed to update field ${fieldId}`;
}

function addExpressionRule(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;

  const effect = args.effect as string;
  const expression = args.expression as string | undefined;

  if (!effect) return `Missing 'effect' (visible|enable|required)`;
  if (!expression?.trim()) return `Missing 'expression'`;

  const node = tools.getField(fieldId);
  if (!node) return `Field not found: ${fieldId}`;

  const existing = (node.definition as { rules?: unknown[] }).rules ?? [];
  const newRule = {
    effect,
    logic: 'AND',
    conditions: [{ conditionType: 'expression', expression: expression.trim() }],
  };
  const ok = tools.updateField(fieldId, { rules: [...existing, newRule] });
  return ok
    ? `Added ${effect} expression rule (index ${existing.length}) to field ${fieldId}`
    : `Failed to update field ${fieldId}`;
}

function removeRule(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined,
  );
  if (!fieldId) return `Field not found`;

  const ruleIndex = args.ruleIndex as number;
  if (typeof ruleIndex !== 'number') return `Missing 'ruleIndex' (number)`;

  const node = tools.getField(fieldId);
  if (!node) return `Field not found: ${fieldId}`;

  const existing = (node.definition as { rules?: unknown[] }).rules ?? [];
  if (ruleIndex < 0 || ruleIndex >= existing.length)
    return `Rule index ${ruleIndex} out of range (field has ${existing.length} rule(s))`;

  const updated = existing.filter((_, i) => i !== ruleIndex);
  const ok = tools.updateField(fieldId, { rules: updated });
  return ok ? `Removed rule ${ruleIndex} from field ${fieldId}` : `Failed to update field ${fieldId}`;
}
