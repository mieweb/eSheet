// ---------------------------------------------------------------------------
// BuilderTools — narrow facade for MCP / AI tool callers only.
// Normal developers interact with the builder entirely through its props/UI.
// ---------------------------------------------------------------------------

import type { AddFieldOptions, FieldType, FormStore } from '@esheet/core';

/** Summary of a single field, suitable for AI context. */
export interface FieldSummary {
  id: string;
  fieldType: string;
  question: string | undefined;
  required: boolean;
  optionCount: number;
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
  /** Snapshot of the current form suitable for AI context. */
  getFormSummary: () => {
    formId: string;
    fieldCount: number;
    fields: FieldSummary[];
  };
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
    addField: (fieldType, opts) => form.getState().addField(fieldType, opts),
    updateField: (fieldId, patch) => form.getState().updateField(fieldId, patch),
    removeField: (fieldId) => form.getState().removeField(fieldId),
    resolveFieldId,
    getFormSummary: () => {
      const { normalized, formId } = form.getState();
      return {
        formId,
        fieldCount: Object.keys(normalized.byId).length,
        fields: normalized.rootIds.map((id) => {
          const node = normalized.byId[id];
          return {
            id,
            fieldType: node.definition.fieldType,
            question: node.definition.question,
            required: node.definition.required ?? false,
            optionCount:
              (node.definition as { options?: unknown[] }).options?.length ?? 0,
          };
        }),
      };
    },
  };
}
