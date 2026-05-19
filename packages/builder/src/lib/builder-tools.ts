// ---------------------------------------------------------------------------
// BuilderTools — narrow facade for MCP / AI tool callers only.
// Normal developers interact with the builder entirely through its props/UI.
// ---------------------------------------------------------------------------

import type { AddFieldOptions, FieldResponse, FieldType, FieldTypeMeta, FormDefinition, FormStore } from '@esheet/core';
import { getFieldTypeMeta, getRegisteredFieldTypes, hydrateDefinition } from '@esheet/core';

/** Summary of a single field, suitable for AI context. */
export interface FieldSummary {
  id: string;
  fieldType: string;
  question: string | undefined;
  required: boolean;
  // replaces optionCount — gives the AI option ids to use with update_option/remove_option
  options: { id: string; value: string }[];
  rows: { id: string; value: string }[];
  columns: { id: string; value: string }[];
  /** Which tool family to use: 'add_option' for option-based fields, 'add_row / add_column' for matrix fields. */
  editWith: string;
  /** True if this field has conditional logic rules attached. Use get_field to inspect them. */
  hasRules: boolean;
  /** Section child fields (only present when fieldType === 'section'). */
  children?: FieldSummary[];
}

/**
 * Narrow interface exposed to MCP / AI tools via `onBuilderToolsReady`.
 * Only the operations an external AI agent needs — no raw store internals.
 */
export interface BuilderTools {
  /** Add a new field. Returns the generated ID, or null for unknown type. */
  addField: (fieldType: FieldType, opts?: AddFieldOptions) => string | null;
  /** Patch a field's properties. Returns false if the field was not found. */
  updateField: (fieldId: string, patch: Record<string, unknown>) => boolean;
  /** Remove a field. Returns false if not found. */
  removeField: (fieldId: string) => boolean;
  /** Find a field ID by exact ID or partial question match. */
  resolveFieldId: (fieldId?: string, fieldQuestion?: string) => string | undefined;
  /** Replace the entire form with a new definition. */
  resetForm: (definition: { id?: string; fields: Record<string, unknown>[] }) => void;
  /** Generate a form from a list of plain question descriptors. */
  generateForm: (questions: { question: string; fieldType?: string; required?: boolean; inputType?: string; options?: string[] }[]) => string;
  /** Snapshot of the current form suitable for AI context. */
  getFormSummary: () => {
    formId: string;
    fieldCount: number;
    fields: FieldSummary[];
  };
  /** Set a response value for a field (for testing in preview mode). */
  fillField: (fieldId: string, value: unknown) => boolean;
  /** Clear all responses. */
  clearResponses: () => void;
  /** Get current responses keyed by field ID. */
  getResponses: () => Record<string, unknown>;
  /** Granular option mutations (radio, check, dropdown, etc.). */
  option: {
    add: (fieldId: string, value?: string) => string | null;
    update: (fieldId: string, optionId: string, value: string) => boolean;
    remove: (fieldId: string, optionId: string) => boolean;
  };
  /** Granular row mutations (matrix fields). */
  row: {
    add: (fieldId: string, value?: string) => string | null;
    update: (fieldId: string, rowId: string, value: string) => boolean;
    remove: (fieldId: string, rowId: string) => boolean;
  };
  /** Granular column mutations (matrix fields). */
  column: {
    add: (fieldId: string, value?: string) => string | null;
    update: (fieldId: string, columnId: string, value: string) => boolean;
    remove: (fieldId: string, columnId: string) => boolean;
  };
  /** Move a field to a new index. */
  moveField: (fieldId: string, toIndex: number, toParentId?: string | null) => boolean;
  /** Get a single field node by ID. */
  getField: (fieldId: string) => import('@esheet/core').FieldNode | undefined;
  /** List all registered field type keys and their labels. */
  getFieldTypes: () => { key: string; label: string; category: string; hasOptions: boolean; hasMatrix: boolean }[];
  /** Get full spec for a single field type (properties, capabilities, defaults). */
  getFieldSpec: (fieldType: string) => FieldTypeMeta | undefined;
  /** Export the full form definition tree (inverse of loadDefinition). */
  getDefinition: () => import('@esheet/core').FormDefinition;
}

export function createBuilderTools(form: FormStore): BuilderTools {
  function resolveFieldId(
    fieldId?: string,
    fieldQuestion?: string,
  ): string | undefined {
    if (fieldId) return fieldId;
    if (fieldQuestion) {
      const q = fieldQuestion.toLowerCase();
      const { normalized } = form.getState();
      for (const id of Object.keys(normalized.byId)) {
        const question = normalized.byId[id].definition.question;
        if (question?.toLowerCase().includes(q)) return id;
      }
    }
    return undefined;
  }

  return {
    resetForm: (definition) =>
      form.getState().loadDefinition(definition as unknown as FormDefinition),
    generateForm: (questions) => {
      const fields = questions.map((q, i) => ({
        id: `f${i + 1}`,
        fieldType: q.fieldType ?? 'text',
        question: q.question,
        ...(q.required !== undefined && { required: q.required }),
        ...(q.inputType && { inputType: q.inputType }),
        ...(q.options && { options: q.options.map((v, j) => ({ id: `o${j + 1}`, value: v })) }),
      }));
      form.getState().loadDefinition({ id: form.getState().formId, fields: [] } as unknown as FormDefinition);
      form.getState().loadDefinition({ id: form.getState().formId, fields } as unknown as FormDefinition);
      const summary = fields.map((f, i) => `${i + 1}. ${f.question} (${f.fieldType})`).join(', ');
      return `Form generated with ${fields.length} field(s): ${summary}`;
    },
    addField: (fieldType, opts) => form.getState().addField(fieldType, opts),
    updateField: (fieldId, patch) => form.getState().updateField(fieldId, patch),
    removeField: (fieldId) => form.getState().removeField(fieldId),
    resolveFieldId,
    fillField: (fieldId, value) => {
      const { normalized } = form.getState();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      const def = node.definition as {
        fieldType: string;
        options?: { id: string; value: string }[];
        rows?: { id: string; value: string }[];
        columns?: { id: string; value: string }[];
      };
      let response: FieldResponse;
      if (def.fieldType === 'singlematrix' && value !== null && typeof value === 'object') {
        // value is Record<rowLabel, columnLabel|columnIndex> or array of columnLabel|columnIndex (one per row).
        // Merge into existing selections so one-row-at-a-time calls accumulate correctly.
        const rows = def.rows ?? [];
        const columns = def.columns ?? [];
        const existing = (form.getState().responses[fieldId]?.selected ?? {}) as Record<string, { id: string; value: string }>;
        const selected: Record<string, { id: string; value: string }> = { ...existing };
        const entries: [string, unknown][] = Array.isArray(value)
          ? (value as unknown[]).map((v, i) => [rows[i]?.value ?? String(i), v])
          : Object.entries(value as Record<string, unknown>);
        for (const [rowKey, colVal] of entries) {
          const row = rows.find(
            (r) => r.value.toLowerCase() === rowKey.toLowerCase() || r.id === rowKey,
          );
          if (!row) continue;
          const colStr = String(colVal);
          const col =
            columns.find((c) => c.value.toLowerCase() === colStr.toLowerCase() || c.id === colStr) ??
            columns[parseInt(colStr, 10)];
          if (col) selected[row.id] = { id: col.id, value: col.value };
        }
        response = { selected };
      } else if (['radio', 'dropdown', 'boolean'].includes(def.fieldType)) {
        const opts = def.options ?? [];
        const match = opts.find(
          (o) => o.value.toLowerCase() === String(value).toLowerCase() || o.id === value,
        );
        response = match ? { selected: { id: match.id, value: match.value } } : { selected: undefined };
      } else if (def.fieldType === 'check' || def.fieldType === 'multiselectdropdown') {
        const opts = def.options ?? [];
        const vals = Array.isArray(value) ? (value as unknown[]) : [value];
        const matches = opts.filter((o) =>
          vals.some((v) => o.value.toLowerCase() === String(v).toLowerCase() || o.id === v),
        );
        response = { selected: matches.map((o) => ({ id: o.id, value: o.value })) };
      } else {
        response = { answer: value as string | undefined };
      }
      form.getState().setResponse(fieldId, { ...response, _ai: true } as FieldResponse);
      return true;
    },
    clearResponses: () => form.getState().resetResponses(),
    getResponses: () => form.getState().responses as Record<string, unknown>,
    option: {
      add: (fieldId, value) => form.getState().addOption(fieldId, value),
      update: (fieldId, optionId, value) => form.getState().updateOption(fieldId, optionId, value),
      remove: (fieldId, optionId) => form.getState().removeOption(fieldId, optionId),
    },
    row: {
      add: (fieldId, value) => form.getState().addRow(fieldId, value),
      update: (fieldId, rowId, value) => form.getState().updateRow(fieldId, rowId, value),
      remove: (fieldId, rowId) => form.getState().removeRow(fieldId, rowId),
    },
    column: {
      add: (fieldId, value) => form.getState().addColumn(fieldId, value),
      update: (fieldId, columnId, value) => form.getState().updateColumn(fieldId, columnId, value),
      remove: (fieldId, columnId) => form.getState().removeColumn(fieldId, columnId),
    },
    moveField: (fieldId, toIndex, toParentId) => form.getState().moveField(fieldId, toIndex, toParentId),
    getField: (fieldId) => form.getState().getField(fieldId),
    getFieldTypes: () =>
      getRegisteredFieldTypes().map((key) => {
        const meta = getFieldTypeMeta(key)!;
        return { key, label: meta.label, category: meta.category, hasOptions: meta.hasOptions, hasMatrix: meta.hasMatrix };
      }),
    getFieldSpec: (fieldType) => getFieldTypeMeta(fieldType),
    getDefinition: () => {
      const { normalized, formId } = form.getState();
      return { id: formId, fields: hydrateDefinition(normalized) } as FormDefinition;
    },
    getFormSummary: () => {
      const { normalized, formId } = form.getState();

      type FieldDef = {
        fieldType: string;
        question?: string;
        title?: string;
        required?: boolean;
        options?: { id: string; value: string }[];
        rows?: { id: string; value: string }[];
        columns?: { id: string; value: string }[];
        rules?: unknown[];
      };

      function summarizeField(id: string): FieldSummary & { children?: ReturnType<typeof summarizeField>[] } {
        const node = normalized.byId[id];
        const def = node.definition as FieldDef;
        const isMatrix = def.fieldType === 'singlematrix' || def.fieldType === 'multimatrix';
        const isSection = def.fieldType === 'section';
        const base = {
          id,
          fieldType: def.fieldType,
          question: isSection ? (def as unknown as { title?: string }).title : def.question,
          required: def.required ?? false,
          options: def.options ?? [],
          rows: def.rows ?? [],
          columns: def.columns ?? [],
          editWith: isMatrix ? 'add_row / add_column (NOT add_option)' : 'add_option',
          hasRules: (def.rules?.length ?? 0) > 0,
        };
        if (isSection && node.childIds.length > 0) {
          return { ...base, children: node.childIds.map(summarizeField) };
        }
        return base;
      }

      return {
        formId,
        fieldCount: Object.keys(normalized.byId).length,
        fields: normalized.rootIds.map(summarizeField),
      };
    },
  };
}
