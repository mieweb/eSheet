// ---------------------------------------------------------------------------
// RendererTools — narrow facade for MCP / AI tool callers only.
// ---------------------------------------------------------------------------

import {
  validateForm,
  type FieldResponse,
  type FormStore,
  type ValidationError,
} from '@esheet/core';
import { buildRenderTree as renderer } from '@esheet/core';
import type { RenderFieldNode } from '@esheet/core';

/** Summary of a single field, suitable for AI context. */
export interface RendererFieldSummary {
  id: string;
  fieldType: string;
  /** For text fields: the HTML input type (e.g. 'date', 'datetime-local', 'month', 'time', 'email', 'number'). Use the correct format when filling this field. */
  inputType?: string;
  /** Required value format for structured input types. Use this exact format when calling fill_field. */
  valueFormat?: string;
  question: string | undefined;
  required: boolean;
  /** True if this field already has a response value. False means it is still empty and needs to be filled. */
  hasValue: boolean;
  /** Available option values for selection fields (radio, check, dropdown, etc.). Only present when the field has options. */
  options?: string[];
  /** Available row labels for matrix fields. Only present for singlematrix / multimatrix. */
  rows?: string[];
  /** Available column labels for matrix fields. Only present for singlematrix / multimatrix. */
  columns?: string[];
}

/**
 * Narrow interface exposed to MCP / AI tools via `onRendererToolsReady`.
 * Read-oriented: inspect responses, fill responses, and query the render tree.
 */
export interface RendererTools {
  /** Currently visible, fillable fields with their available options. */
  getForm: () => {
    formId: string;
    fieldCount: number;
    fields: RendererFieldSummary[];
  };
  /** All fields in the form regardless of visibility, rules, or enabled state. */
  getFormRaw: () => {
    formId: string;
    fieldCount: number;
    fields: RendererFieldSummary[];
  };
  /** Get current raw responses keyed by field ID. */
  getResponses: () => Record<string, unknown>;
  /** Get validated responses — returns null if validation fails. */
  getValidResponse: () => {
    response: Record<string, unknown> | null;
    errors: ValidationError[];
  };
  /** Set a response value for one visible field. Returns true on success, false if field not found/visible, or an error string if the value format is invalid. */
  fillField: (fieldId: string, value: unknown) => boolean | string;
  /** Clear all responses. */
  clearResponses: () => void;
  /** Full render tree with visibility/enabled/required per field. */
  getFormTree: () => RenderFieldNode[];
  /** Find a field ID by exact ID or partial question match. */
  resolveFieldId: (
    fieldId?: string,
    fieldQuestion?: string
  ) => string | undefined;
}

const NON_INPUT = new Set(['section', 'html', 'display', 'image', 'diagram']);

/** Flatten the render tree into only visible, fillable leaf nodes. */
function flattenVisible(nodes: RenderFieldNode[]): RenderFieldNode[] {
  const result: RenderFieldNode[] = [];
  for (const node of nodes) {
    if (!node.visible) continue;
    if (node.children.length > 0) {
      result.push(...flattenVisible(node.children));
    } else if (!NON_INPUT.has(node.definition.fieldType as string)) {
      result.push(node);
    }
  }
  return result;
}

export function createRendererTools(formStore: FormStore): RendererTools {
  function resolveFieldId(
    fieldId?: string,
    fieldQuestion?: string
  ): string | undefined {
    if (fieldId) return fieldId;
    if (fieldQuestion) {
      const q = fieldQuestion.toLowerCase();
      const { normalized } = formStore.getState();
      for (const id of Object.keys(normalized.byId)) {
        const question = normalized.byId[id].definition.question;
        if (question?.toLowerCase().includes(q)) return id;
      }
    }
    return undefined;
  }

  function getCurrentRenderTree(): RenderFieldNode[] {
    const { formId, responses } = formStore.getState();
    const definition = formStore.getState().hydrateDefinition();
    if (!definition) return [];
    return renderer(
      { ...definition, id: formId } as Parameters<typeof renderer>[0],
      responses as Parameters<typeof renderer>[1]
    );
  }

  const INPUT_TYPE_FORMAT: Record<string, string> = {
    date: 'YYYY-MM-DD',
    'datetime-local': 'YYYY-MM-DDTHH:mm',
    month: 'YYYY-MM',
    time: 'HH:mm',
  };

  function toFieldSummary(
    id: string,
    def: {
      fieldType: string;
      inputType?: string;
      question?: string;
      required?: boolean;
      options?: { id: string; value: string }[];
      rows?: { id: string; value: string }[];
      columns?: { id: string; value: string }[];
    },
    required?: boolean
  ): RendererFieldSummary {
    const response = formStore.getState().responses[id];
    const hasValue =
      response != null &&
      Object.values(response).some(
        (v) =>
          v != null &&
          v !== '' &&
          !(Array.isArray(v) && v.length === 0) &&
          !(
            typeof v === 'object' &&
            !Array.isArray(v) &&
            Object.keys(v as object).length === 0
          )
      );
    const summary: RendererFieldSummary = {
      id,
      fieldType: def.fieldType,
      question: def.question,
      required: required ?? def.required ?? false,
      hasValue,
    };
    if (def.inputType) summary.inputType = def.inputType;
    if (def.inputType && INPUT_TYPE_FORMAT[def.inputType])
      summary.valueFormat = INPUT_TYPE_FORMAT[def.inputType];
    if (def.options && def.options.length > 0)
      summary.options = def.options.map((o) => o.value);
    if (def.rows && def.rows.length > 0)
      summary.rows = def.rows.map((r) => r.value);
    if (def.columns && def.columns.length > 0)
      summary.columns = def.columns.map((c) => c.value);
    return summary;
  }

  /**
   * Normalize and validate a text value for a given inputType.
   * Returns the normalized string on success, or null if the value cannot
   * be coerced into a valid format (caller should reject the fill).
   */
  function normalizeTextValue(
    value: string,
    inputType?: string
  ): string | null {
    if (!value) return value;
    switch (inputType) {
      case 'date': {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
        if (/^\d{4}$/.test(value)) return `${value}-01-01`;
        return null; // not a recognisable date
      }
      case 'month': {
        if (/^\d{4}-\d{2}$/.test(value)) return value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
        return null;
      }
      case 'datetime-local': {
        const n = value.replace(' ', 'T');
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(n)) return n;
        if (/^\d{4}-\d{2}-\d{2}$/.test(n)) return `${n}T00:00`;
        return null;
      }
      case 'time': {
        if (/^\d{2}:\d{2}$/.test(value)) return value;
        const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let h = parseInt(match[1], 10);
          const m = match[2];
          const period = match[3].toUpperCase();
          if (period === 'AM' && h === 12) h = 0;
          if (period === 'PM' && h !== 12) h += 12;
          return `${String(h).padStart(2, '0')}:${m}`;
        }
        return null;
      }
      default:
        return value;
    }
  }

  function applyFieldValue(
    fieldId: string,
    value: unknown,
    checkVisibility: boolean
  ): boolean | string {
    const { normalized } = formStore.getState();
    const node = normalized.byId[fieldId];
    if (!node) return false;
    if (checkVisibility) {
      const visibleIds = new Set(
        flattenVisible(getCurrentRenderTree()).map((n) => n.id)
      );
      if (!visibleIds.has(fieldId)) return false;
    }
    const def = node.definition as {
      fieldType: string;
      inputType?: string;
      options?: { id: string; value: string }[];
      rows?: { id: string; value: string }[];
      columns?: { id: string; value: string }[];
    };
    let response: FieldResponse;
    if (
      def.fieldType === 'singlematrix' &&
      value !== null &&
      typeof value === 'object'
    ) {
      const rows = def.rows ?? [];
      const columns = def.columns ?? [];
      const existing = (formStore.getState().responses[fieldId]?.selected ??
        {}) as Record<string, { id: string; value: string }>;
      const selected: Record<string, { id: string; value: string }> = {
        ...existing,
      };
      const entries: [string, unknown][] = Array.isArray(value)
        ? (value as unknown[]).map((v, i) => [rows[i]?.value ?? String(i), v])
        : Object.entries(value as Record<string, unknown>);
      for (const [rowKey, colVal] of entries) {
        const row = rows.find(
          (r) =>
            r.value.toLowerCase() === rowKey.toLowerCase() || r.id === rowKey
        );
        if (!row) continue;
        const colStr = String(colVal);
        const col =
          columns.find(
            (c) =>
              c.value.toLowerCase() === colStr.toLowerCase() || c.id === colStr
          ) ?? columns[parseInt(colStr, 10)];
        if (col) selected[row.id] = { id: col.id, value: col.value };
      }
      response = { selected };
    } else if (
      def.fieldType === 'multimatrix' &&
      value !== null &&
      typeof value === 'object'
    ) {
      // multimatrix: { selected: Record<rowId, SelectedOption[]> }
      const rows = def.rows ?? [];
      const columns = def.columns ?? [];
      const existing = (formStore.getState().responses[fieldId]?.selected ??
        {}) as Record<string, { id: string; value: string }[]>;
      const selected: Record<string, { id: string; value: string }[]> = {
        ...existing,
      };
      const entries: [string, unknown][] = Array.isArray(value)
        ? (value as unknown[]).map((v, i) => [rows[i]?.value ?? String(i), v])
        : Object.entries(value as Record<string, unknown>);
      for (const [rowKey, colVals] of entries) {
        const row = rows.find(
          (r) =>
            r.value.toLowerCase() === rowKey.toLowerCase() || r.id === rowKey
        );
        if (!row) continue;
        const colValArr = Array.isArray(colVals)
          ? (colVals as unknown[])
          : [colVals];
        const matched = colValArr
          .map((v) => {
            const s = String(v);
            return columns.find(
              (c) => c.value.toLowerCase() === s.toLowerCase() || c.id === s
            );
          })
          .filter((c): c is { id: string; value: string } => c != null);
        if (matched.length > 0) selected[row.id] = matched;
      }
      response = { selected };
    } else if (
      ['radio', 'dropdown', 'boolean', 'rating', 'slider'].includes(
        def.fieldType
      )
    ) {
      const opts = def.options ?? [];
      const match = opts.find(
        (o) =>
          o.value.toLowerCase() === String(value).toLowerCase() ||
          o.id === value
      );
      // For slider/rating, also try matching by numeric index or option value as number
      const numVal = Number(value);
      const numMatch =
        !match && !isNaN(numVal) ? opts[numVal - 1] ?? opts[numVal] : undefined;
      const resolved = match ?? numMatch;
      response = resolved
        ? { selected: { id: resolved.id, value: resolved.value } }
        : { selected: undefined };
    } else if (
      def.fieldType === 'check' ||
      def.fieldType === 'multiselectdropdown'
    ) {
      const opts = def.options ?? [];
      const vals = Array.isArray(value) ? (value as unknown[]) : [value];
      const matches = opts.filter((o) =>
        vals.some(
          (v) => o.value.toLowerCase() === String(v).toLowerCase() || o.id === v
        )
      );
      response = {
        selected: matches.map((o) => ({ id: o.id, value: o.value })),
      };
    } else if (def.fieldType === 'ranking') {
      // ranking: { selected: SelectedOption[] } in the user-specified order
      const opts = def.options ?? [];
      const vals = Array.isArray(value) ? (value as unknown[]) : [value];
      const ordered = vals
        .map((v) =>
          opts.find(
            (o) =>
              o.value.toLowerCase() === String(v).toLowerCase() || o.id === v
          )
        )
        .filter((o): o is { id: string; value: string } => o != null);
      // append any options not mentioned by the user at the end
      const mentioned = new Set(ordered.map((o) => o.id));
      const remaining = opts.filter((o) => !mentioned.has(o.id));
      response = { selected: [...ordered, ...remaining] };
    } else if (def.fieldType === 'multitext') {
      // multitext: { multitextAnswers: Record<optionId, string> }
      const opts = def.options ?? [];
      const vals = Array.isArray(value)
        ? (value as unknown[])
        : typeof value === 'object' && value !== null
        ? Object.values(value as Record<string, unknown>)
        : [value];
      const multitextAnswers: Record<string, string> = {};
      opts.forEach((opt, i) => {
        if (vals[i] != null) multitextAnswers[opt.id] = String(vals[i]);
      });
      response = { multitextAnswers };
    } else {
      if (value == null) {
        response = { answer: undefined };
      } else {
        const normalized = normalizeTextValue(String(value), def.inputType);
        if (normalized === null) {
          const fmt: Record<string, string> = {
            date: 'YYYY-MM-DD',
            'datetime-local': 'YYYY-MM-DDTHH:mm',
            month: 'YYYY-MM',
            time: 'HH:mm',
          };
          const expected = fmt[def.inputType ?? ''];
          return expected
            ? `Error: invalid value for inputType "${
                def.inputType
              }" — expected format ${expected} (e.g. ${new Date()
                .toISOString()
                .slice(0, expected.length)
                .replace('T', 'T')
                .replace(/[^\dT:-]/g, '0')})`
            : `Error: invalid value for field`;
        }
        response = { answer: normalized };
      }
    }
    formStore.getState().setResponse(fieldId, response);
    return true;
  }

  return {
    getForm: () => {
      const { formId } = formStore.getState();
      type FieldDef = {
        fieldType: string;
        inputType?: string;
        question?: string;
        required?: boolean;
        options?: { id: string; value: string }[];
        rows?: { id: string; value: string }[];
        columns?: { id: string; value: string }[];
      };
      const visibleNodes = flattenVisible(getCurrentRenderTree());
      const fields = visibleNodes.map((node) =>
        toFieldSummary(
          node.id,
          node.definition as unknown as FieldDef,
          node.required
        )
      );
      return { formId, fieldCount: fields.length, fields };
    },

    getFormRaw: () => {
      const { normalized, formId } = formStore.getState();
      type FieldDef = {
        fieldType: string;
        inputType?: string;
        question?: string;
        required?: boolean;
        options?: { id: string; value: string }[];
        rows?: { id: string; value: string }[];
        columns?: { id: string; value: string }[];
      };
      const fields = Object.keys(normalized.byId)
        .filter(
          (id) =>
            !NON_INPUT.has(
              (normalized.byId[id].definition as FieldDef).fieldType
            )
        )
        .map((id) =>
          toFieldSummary(
            id,
            normalized.byId[id].definition as unknown as FieldDef
          )
        );
      return { formId, fieldCount: fields.length, fields };
    },

    getResponses: () =>
      formStore.getState().responses as Record<string, unknown>,

    getValidResponse: () => {
      const state = formStore.getState();
      const errors = validateForm(state.normalized, state.responses);
      return {
        response:
          errors.length === 0
            ? (state.responses as Record<string, unknown>)
            : null,
        errors,
      };
    },

    fillField: (fieldId, value) =>
      applyFieldValue(fieldId, value, true) as boolean | string,

    clearResponses: () => formStore.getState().resetResponses(),

    getFormTree: () => getCurrentRenderTree(),

    resolveFieldId,
  };
}
