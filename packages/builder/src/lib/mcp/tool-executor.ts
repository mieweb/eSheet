import type { BuilderTools } from '../builder-tools.js';

type FieldType = Parameters<BuilderTools['addField']>[0];
type AddFieldOptions = NonNullable<Parameters<BuilderTools['addField']>[1]>;

type ToolArgs = Record<string, unknown>;

export function executeToolCall(
  toolName: string,
  args: ToolArgs,
  tools: BuilderTools
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
      return getFormSummaryOptimized(tools);
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
    case 'set_option_score':
      return setOptionScore(args, tools);
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
    case 'set_column_score':
      return setColumnScore(args, tools);
    case 'remove_column':
      return removeColumn(args, tools);
    case 'get_field_types':
      return { fieldTypes: tools.getFieldTypes() };
    case 'get_field_spec':
      return getFieldSpec(args, tools);
    case 'get_definition':
      return tools.getDefinition() as unknown as Record<string, unknown>;
    case 'set_form_id': {
      const id = String(args['id'] ?? '');
      if (!id) return 'Error: id is required';
      tools.setFormId(id);
      return `Form ID set to "${id}"`;
    }
    case 'add_field_rule':
      return addFieldRule(args, tools);
    case 'add_expression_rule':
      return addExpressionRule(args, tools);
    case 'remove_rule':
      return removeRule(args, tools);
    case 'bulk_fill':
      return bulkFill(args, tools);
    case 'bulk_build':
      return bulkBuild(args, tools);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

const PLACEHOLDER_IDS = new Set(['q1', 'q2', 'q3']);

function createField(args: ToolArgs, tools: BuilderTools): string {
  // Auto-clear placeholder fields on first AI-created field.
  const { fields } = tools.getFormSummary();
  if (fields.length > 0 && fields.every((f) => PLACEHOLDER_IDS.has(f.id))) {
    tools.resetForm({ id: 'form-1', fields: [] });
  }

  const fieldType = args.fieldType as FieldType;
  // Sections cannot be nested inside other sections.
  if (fieldType === 'section' && args.parentId) {
    return 'Error: sections cannot be placed inside another section. Create sections at the root level only.';
  }
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
      const obj = o as { id?: string; value?: string; score?: number };
      const opt: Record<string, unknown> = {
        id: obj.id ?? `o${i + 1}`,
        value: obj.value ?? '',
      };
      if (obj.score != null) opt.score = obj.score;
      return opt;
    });
  }

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

type CondensedField = {
  id: string;
  fieldType: string;
  question: string;
  required: boolean;
  optionCount: number;
  rowCount: number;
  columnCount: number;
  editWith: string;
  hasRules: boolean;
  hasValue: boolean;
  valueFormat?: string;
  children?: CondensedField[];
};

function condenseField(
  f: ReturnType<BuilderTools['getFormSummary']>['fields'][number]
): CondensedField {
  const base: CondensedField = {
    id: f.id,
    fieldType: f.fieldType,
    question: f.question ?? '',
    required: f.required,
    optionCount: f.options?.length ?? 0,
    rowCount: f.rows?.length ?? 0,
    columnCount: f.columns?.length ?? 0,
    editWith: f.editWith,
    hasRules: f.hasRules,
    hasValue: f.hasValue,
    ...(f.valueFormat ? { valueFormat: f.valueFormat } : {}),
  };
  if (f.children && f.children.length > 0) {
    base.children = f.children.map(condenseField);
  }
  return base;
}

function flattenCondensed(fields: CondensedField[]): CondensedField[] {
  const result: CondensedField[] = [];
  for (const f of fields) {
    // Skip section containers — they are layout wrappers, not fillable fields.
    // Their children are still included.
    if (f.fieldType === 'section') {
      if (f.children && f.children.length > 0) {
        result.push(...flattenCondensed(f.children));
      }
    } else {
      result.push(f);
    }
  }
  return result;
}

/** Optimized get_form_summary: condenses options/rows/columns to counts to reduce token usage. */
function getFormSummaryOptimized(tools: BuilderTools): Record<string, unknown> {
  const summary = tools.getFormSummary();
  // Condense field details: replace full option arrays with counts, preserve section children
  const condensedFields = summary.fields.map(condenseField);
  return {
    formId: summary.formId,
    fieldCount: summary.fieldCount,
    fields: condensedFields,
    hint: 'Use get_field for full option/row/column details',
  };
}

function fillField(
  args: ToolArgs,
  tools: BuilderTools
): string | Record<string, unknown> {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;
  const result = tools.fillField(fieldId, args.value);
  if (typeof result === 'string') return result; // format validation error
  if (!result) return `Field not found: ${fieldId}`;
  const summary = tools.getFormSummary();
  const allCondensed = flattenCondensed(summary.fields.map(condenseField));
  const field = allCondensed.find((f) => f.id === fieldId);
  const label = field?.question ?? fieldId;
  const filledFields = allCondensed.filter((f) => f.hasValue);
  const allUnfilled = allCondensed.filter((f) => !f.hasValue);
  // Split unfilled into fillable (no rules) vs conditionally hidden (has rules).
  // Fields with rules may be hidden by conditional logic — do not loop on them.
  const unfilledFields = allUnfilled.filter((f) => !f.hasRules);
  const conditionallyHiddenCount = allUnfilled.filter((f) => f.hasRules).length;
  return {
    result: `Filled "${label}" with ${JSON.stringify(args.value)}`,
    filledCount: filledFields.length,
    unfilledFields,
    ...(conditionallyHiddenCount > 0 ? { conditionallyHiddenCount } : {}),
  };
}

function bulkFill(
  args: ToolArgs,
  tools: BuilderTools
): Record<string, unknown> {
  const entries = args.fields as
    | { fieldId?: string; fieldQuestion?: string; value: unknown }[]
    | undefined;
  if (!Array.isArray(entries) || entries.length === 0)
    return { error: "Missing 'fields' array" };

  const results: { field: string; status: string }[] = [];
  for (const entry of entries) {
    const fieldId = tools.resolveFieldId(entry.fieldId, entry.fieldQuestion);
    if (!fieldId) {
      results.push({
        field: entry.fieldId ?? entry.fieldQuestion ?? '?',
        status: 'not found',
      });
      continue;
    }
    const result = tools.fillField(fieldId, entry.value);
    if (typeof result === 'string') {
      results.push({ field: fieldId, status: result });
    } else if (!result) {
      results.push({ field: fieldId, status: 'not found' });
    } else {
      results.push({ field: fieldId, status: 'filled' });
    }
  }

  const summary = tools.getFormSummary();
  const allCondensed = flattenCondensed(summary.fields.map(condenseField));
  const allUnfilled = allCondensed.filter((f) => !f.hasValue);
  // Split unfilled into fillable (no rules) vs conditionally hidden (has rules).
  const unfilledFields = allUnfilled.filter((f) => !f.hasRules);
  const conditionallyHiddenCount = allUnfilled.filter((f) => f.hasRules).length;
  return {
    results,
    filledCount: allCondensed.filter((f) => f.hasValue).length,
    unfilledFields,
    ...(conditionallyHiddenCount > 0 ? { conditionallyHiddenCount } : {}),
  };
}

function bulkBuild(
  args: ToolArgs,
  tools: BuilderTools
): Record<string, unknown> {
  const entries = args.fields as
    | {
        fieldType: string;
        question?: string;
        required?: boolean;
        options?: unknown[];
        rows?: string[];
        columns?: string[];
        parentId?: string;
        properties?: Record<string, unknown>;
      }[]
    | undefined;
  if (!Array.isArray(entries) || entries.length === 0)
    return { error: "Missing 'fields' array" };

  // Auto-clear placeholder fields before bulk build
  const { fields } = tools.getFormSummary();
  if (fields.length > 0 && fields.every((f) => PLACEHOLDER_IDS.has(f.id))) {
    tools.resetForm({ id: 'form-1', fields: [] });
  }

  const created: { question: string; id: string; fieldType: string }[] = [];
  const errors: { question: string; error: string }[] = [];

  for (const entry of entries) {
    const fieldType = entry.fieldType as FieldType;
    // Sections cannot be nested inside other sections.
    if (fieldType === 'section' && entry.parentId) {
      errors.push({
        question: entry.question ?? fieldType,
        error: 'sections cannot be placed inside another section',
      });
      continue;
    }
    const patch: Record<string, unknown> = {
      question: entry.question ?? '',
    };
    if (entry.required !== undefined) patch.required = entry.required;
    if (fieldType === 'singlematrix' || fieldType === 'multimatrix') {
      patch.rows = [];
      patch.columns = [];
    }
    if (entry.options) {
      patch.options = entry.options.map((o, i) => {
        if (typeof o === 'string') return { id: `o${i + 1}`, value: o };
        const obj = o as { id?: string; value?: string; score?: number };
        const opt: Record<string, unknown> = {
          id: obj.id ?? `o${i + 1}`,
          value: obj.value ?? '',
        };
        if (obj.score != null) opt.score = obj.score;
        return opt;
      });
    }
    if (entry.properties) Object.assign(patch, entry.properties);

    const opts: AddFieldOptions = {
      patch,
      ...(entry.parentId ? { parentId: entry.parentId } : {}),
    };

    const newId = tools.addField(fieldType, opts);
    if (!newId) {
      errors.push({
        question: entry.question ?? fieldType,
        error: `Unknown field type: ${fieldType}`,
      });
      continue;
    }

    // Add rows and columns for matrix fields
    if (entry.rows) {
      for (const row of entry.rows) tools.row.add(newId, row);
    }
    if (entry.columns) {
      for (const col of entry.columns) tools.column.add(newId, col);
    }

    created.push({
      question: entry.question ?? fieldType,
      id: newId,
      fieldType,
    });
  }

  const summary = tools.getFormSummary();
  return {
    created,
    ...(errors.length > 0 ? { errors } : {}),
    totalFields: summary.fieldCount,
  };
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
    args.fieldQuestion as string | undefined
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
      'content',
      'htmlContent',
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
          (typeof o === 'string' ? o : (o as { value?: string }).value) ===
            existing.value || (o as { id?: string }).id === existing.id
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
    args.fieldQuestion as string | undefined
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;

  const ok = tools.removeField(fieldId);
  return ok ? `Deleted field ${fieldId}` : `Field not found: ${fieldId}`;
}

function getFieldDetail(
  args: ToolArgs,
  tools: BuilderTools
): Record<string, unknown> | string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;
  const node = tools.getField(fieldId);
  if (!node) return `Field not found: ${fieldId}`;
  const def = node.definition as unknown as Record<string, unknown>;
  return { id: fieldId, ...def };
}

function moveField(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId)
    return `Field not found: ${(args.fieldId as string) ?? args.fieldQuestion}`;
  const toIndex = args.toIndex as number;
  if (typeof toIndex !== 'number') return `Missing 'toIndex' (number)`;
  const ok = tools.moveField(
    fieldId,
    toIndex,
    (args.toParentId as string | null | undefined) ?? null
  );
  return ok
    ? `Moved field ${fieldId} to index ${toIndex}`
    : `Failed to move field ${fieldId}`;
}

function addRow(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
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
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  let rowId = args.rowId as string | undefined;
  if (!rowId && args.value) {
    const node = tools.getField(fieldId);
    const rows =
      (
        node?.definition as
          | { rows?: { id: string; value: string }[] }
          | undefined
      )?.rows ?? [];
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
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  const ok = tools.row.remove(fieldId, args.rowId as string);
  return ok ? `Removed row ${args.rowId as string}` : `Row not found`;
}

function addColumn(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  const fieldType = getFieldType(fieldId, tools);
  if (fieldType && !MATRIX_TYPES.has(fieldType))
    return `Field '${fieldId}' is a ${fieldType} field — columns only apply to singlematrix/multimatrix fields.`;
  const colId = tools.column.add(fieldId, args.value as string | undefined);
  return colId
    ? `Added column ${colId}`
    : `Field not found or not a matrix field`;
}

function updateColumn(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  let columnId = args.columnId as string | undefined;
  if (!columnId && args.value) {
    const node = tools.getField(fieldId);
    const cols =
      (
        node?.definition as
          | { columns?: { id: string; value: string }[] }
          | undefined
      )?.columns ?? [];
    const match = cols.find((c) => c.value === (args.currentValue as string));
    if (match) columnId = match.id;
  }
  if (!columnId) return `Missing 'columnId'`;
  const ok = tools.column.update(fieldId, columnId, args.value as string);
  return ok ? `Updated column ${columnId}` : `Column not found`;
}

function setColumnScore(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  let columnId = args.columnId as string | undefined;
  if (!columnId && args.currentValue) {
    const node = tools.getField(fieldId);
    const cols =
      (
        node?.definition as
          | { columns?: { id: string; value: string }[] }
          | undefined
      )?.columns ?? [];
    const match = cols.find((c) => c.value === (args.currentValue as string));
    if (match) columnId = match.id;
  }
  if (!columnId)
    return `Missing 'columnId' or 'currentValue' to identify column`;
  const score =
    args.score === null || args.score === undefined
      ? undefined
      : Number(args.score);
  const ok = tools.column.setScore(fieldId, columnId, score);
  return ok
    ? score === undefined
      ? `Cleared score for column ${columnId}`
      : `Set score ${score} for column ${columnId}`
    : `Column not found`;
}

function removeColumn(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  const ok = tools.column.remove(fieldId, args.columnId as string);
  return ok ? `Removed column ${args.columnId as string}` : `Column not found`;
}

function getFieldSpec(
  args: ToolArgs,
  tools: BuilderTools
): Record<string, unknown> | string {
  const fieldType = args.fieldType as string | undefined;
  if (!fieldType) return `Missing 'fieldType'`;
  const spec = tools.getFieldSpec(fieldType);
  if (!spec) return `Unknown field type: ${fieldType}`;
  return spec as unknown as Record<string, unknown>;
}

const MATRIX_TYPES = new Set(['singlematrix', 'multimatrix']);
const OPTION_TYPES = new Set([
  'radio',
  'check',
  'boolean',
  'dropdown',
  'multiselectdropdown',
  'rating',
  'ranking',
  'slider',
  'multitext',
]);

function getFieldType(
  fieldId: string,
  tools: BuilderTools
): string | undefined {
  const node = tools.getField(fieldId);
  return (node?.definition as { fieldType?: string } | undefined)?.fieldType;
}

function addOption(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  const fieldType = getFieldType(fieldId, tools);
  if (fieldType && MATRIX_TYPES.has(fieldType))
    return `'${fieldId}' is a ${fieldType} field — use add_row/add_column, not add_option.`;
  if (fieldType && !OPTION_TYPES.has(fieldType))
    return `'${fieldId}' is a ${fieldType} field — it does not support options.`;
  const optId = tools.option.add(fieldId, args.value as string | undefined);
  return optId
    ? `Added option ${optId}`
    : `Field not found or not an option field`;
}

function updateOption(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  let optionId = args.optionId as string | undefined;
  // Allow resolving by current label if id not provided
  if (!optionId && args.currentValue) {
    const node = tools.getField(fieldId);
    const opts =
      (
        node?.definition as
          | { options?: { id: string; value: string }[] }
          | undefined
      )?.options ?? [];
    const match = opts.find((o) => o.value === (args.currentValue as string));
    if (match) optionId = match.id;
  }
  if (!optionId)
    return `Missing 'optionId' or 'currentValue' to identify option`;
  const ok = tools.option.update(fieldId, optionId, args.value as string);
  return ok ? `Updated option ${optionId}` : `Option not found`;
}

function removeOption(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  let optionId = args.optionId as string | undefined;
  if (!optionId && args.currentValue) {
    const node = tools.getField(fieldId);
    const opts =
      (
        node?.definition as
          | { options?: { id: string; value: string }[] }
          | undefined
      )?.options ?? [];
    const match = opts.find((o) => o.value === (args.currentValue as string));
    if (match) optionId = match.id;
  }
  if (!optionId)
    return `Missing 'optionId' or 'currentValue' to identify option`;
  const ok = tools.option.remove(fieldId, optionId);
  return ok ? `Removed option ${optionId}` : `Option not found`;
}

function setOptionScore(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
  );
  if (!fieldId) return `Field not found`;
  let optionId = args.optionId as string | undefined;
  if (!optionId && args.currentValue) {
    const node = tools.getField(fieldId);
    const opts =
      (
        node?.definition as
          | { options?: { id: string; value: string }[] }
          | undefined
      )?.options ?? [];
    const match = opts.find((o) => o.value === (args.currentValue as string));
    if (match) optionId = match.id;
  }
  if (!optionId)
    return `Missing 'optionId' or 'currentValue' to identify option`;
  const score =
    args.score === null || args.score === undefined
      ? undefined
      : Number(args.score);
  const ok = tools.option.setScore(fieldId, optionId, score);
  return ok
    ? score === undefined
      ? `Cleared score for option ${optionId}`
      : `Set score ${score} for option ${optionId}`
    : `Option not found`;
}

function addFieldRule(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
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

  const mappedConditions = (conditions as Record<string, unknown>[]).map(
    (c) => ({
      conditionType: 'field' as const,
      targetId: c['targetId'] as string,
      operator: c['operator'] as string,
      ...(c['expected'] !== undefined && { expected: c['expected'] as string }),
      ...(c['propertyAccessor'] !== undefined && {
        propertyAccessor: c['propertyAccessor'] as string,
      }),
    })
  );

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
    args.fieldQuestion as string | undefined
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
    conditions: [
      { conditionType: 'expression', expression: expression.trim() },
    ],
  };
  const ok = tools.updateField(fieldId, { rules: [...existing, newRule] });
  return ok
    ? `Added ${effect} expression rule (index ${existing.length}) to field ${fieldId}`
    : `Failed to update field ${fieldId}`;
}

function removeRule(args: ToolArgs, tools: BuilderTools): string {
  const fieldId = tools.resolveFieldId(
    args.fieldId as string | undefined,
    args.fieldQuestion as string | undefined
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
  return ok
    ? `Removed rule ${ruleIndex} from field ${fieldId}`
    : `Failed to update field ${fieldId}`;
}
