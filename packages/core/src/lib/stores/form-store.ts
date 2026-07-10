// ---------------------------------------------------------------------------
// Form Store — Zustand vanilla store for form state management
// ---------------------------------------------------------------------------

import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type {
  FieldResponseMap,
  FieldResponse,
  FieldType,
  FieldOption,
  MatrixRow,
  MatrixColumn,
  FormResponse,
  FormDefinition,
  FieldDefinition,
} from '../types.js';
import { getFieldTypeMeta } from '../registry.js';
import {
  generateFieldId,
  generateOptionId,
  generateRowId,
  generateColumnId,
} from '../functions/ids.js';
import {
  type NormalizedDefinition,
  type FieldNode,
  normalizeDefinition,
  hydrateDefinition,
} from '../functions/normalize.js';
import { hydrateResponse } from '../functions/hydrate-response.js';
import { resolveEffect } from '../logic/resolve.js';
import { evaluateJsExpression } from '../logic/conditions.js';
import {
  validateField,
  validateForm,
  type ValidationError,
} from '../logic/validate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a flat FieldDefinition[] from a FormDefinition's pages array.
 */
function fieldsFromDefinition(def: FormDefinition): FieldDefinition[] {
  return def.pages.map((page) => ({
    fieldType: 'pages' as const,
    id: page.id,
    ...(page.title !== undefined && { title: page.title }),
    ...(page.autoAdvance !== undefined && { autoAdvance: page.autoAdvance }),
    ...(page.fields && { fields: page.fields }),
  })) as FieldDefinition[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the `addField` builder action. */
export interface AddFieldOptions {
  /** Insert as child of this section. If omitted, insert at root level. */
  parentId?: string;
  /** Insert at this index among siblings. If omitted, append at end. */
  index?: number;
  /** Initial property overrides applied after default props. */
  patch?: Record<string, unknown>;
}

/** The full form state — data + actions + selectors. */
export interface FormState {
  // --- Data ---
  /** Unique instance ID — used to generate unique DOM IDs when multiple engines share a page. */
  readonly instanceId: string;
  /** Top-level form identifier used for import/export and schema validation. */
  readonly formId: string;
  /** Human-readable form title preserved from the definition. */
  readonly formTitle?: string;
  /** Human-readable form description preserved from the definition. */
  readonly formDescription?: string;
  /** Opaque metadata preserved from the original import source (e.g. MCP envelope fields). */
  readonly formSourceData?: unknown;
  /** When true, enables dangerously embedded JS — field calculations and conditionType 'js'. */
  readonly dangerouslyAllowJS: boolean;
  /** Flat-indexed map — the source of truth for field structure. */
  readonly normalized: NormalizedDefinition;
  /** Current responses keyed by field ID. */
  readonly responses: FieldResponseMap;
  /** Field IDs that have been explicitly edited by the user (not auto-calculated). */
  readonly userEditedFields: ReadonlySet<string>;

  // --- Lifecycle Actions ---
  /** Load a form definition (tree), normalizing it into the flat index. */
  loadDefinition: (definition: FormDefinition) => void;
  /** Update the top-level form id without replacing fields. */
  setFormId: (id: string) => void;
  /** Update the form title. */
  setFormTitle: (title: string | undefined) => void;
  /** Update the form description. */
  setFormDescription: (description: string | undefined) => void;
  /** Enable or disable dangerously embedded JS for this form. */
  setDangerouslyAllowJS: (enabled: boolean) => void;
  /** Set (or replace) a single field's response. */
  setResponse: (fieldId: string, response: FieldResponse) => void;
  /** Remove a single field's response. */
  clearResponse: (fieldId: string) => void;
  /** Clear all responses. */
  resetResponses: () => void;

  // --- Builder Actions ---
  /** Add a new field. Returns the generated field ID, or `null` if the type is unknown. */
  addField: (fieldType: FieldType, options?: AddFieldOptions) => string | null;
  /** Patch a field's definition. Returns `false` if not found or rename collided. */
  updateField: (fieldId: string, patch: Record<string, unknown>) => boolean;
  /** Remove a field (and its children if it is a section). */
  removeField: (fieldId: string) => boolean;
  /** Move a field to a new position/parent. `toParentId` defaults to current parent; pass `null` for root. */
  moveField: (
    fieldId: string,
    toIndex: number,
    toParentId?: string | null
  ) => boolean;
  /** Add an option. Returns the generated option ID. */
  addOption: (fieldId: string, value?: string) => string | null;
  /** Update an option's value. */
  updateOption: (fieldId: string, optionId: string, value: string) => boolean;
  /** Set or clear an option's numeric score. Pass `undefined` to remove. */
  setOptionScore: (
    fieldId: string,
    optionId: string,
    score: number | undefined
  ) => boolean;
  /** Remove an option. */
  removeOption: (fieldId: string, optionId: string) => boolean;
  /** Add a matrix row. Returns the generated row ID. */
  addRow: (fieldId: string, value?: string) => string | null;
  /** Update a row's value. */
  updateRow: (fieldId: string, rowId: string, value: string) => boolean;
  /** Remove a matrix row. */
  removeRow: (fieldId: string, rowId: string) => boolean;
  /** Add a matrix column. Returns the generated column ID. */
  addColumn: (fieldId: string, value?: string) => string | null;
  /** Update a column's value. */
  updateColumn: (fieldId: string, columnId: string, value: string) => boolean;
  /** Set or clear a column's numeric score. Pass `undefined` to remove. */
  setColumnScore: (
    fieldId: string,
    columnId: string,
    score: number | undefined
  ) => boolean;
  /** Remove a matrix column. */
  removeColumn: (fieldId: string, columnId: string) => boolean;

  // --- Selectors ---
  /** Look up a field node by ID. */
  getField: (fieldId: string) => FieldNode | undefined;
  /** Look up a field's current response. */
  getResponse: (fieldId: string) => FieldResponse | undefined;
  /** Whether a field is currently visible. */
  isVisible: (fieldId: string) => boolean;
  /** Whether a field is currently enabled. */
  isEnabled: (fieldId: string) => boolean;
  /** Whether a field is currently hard-required. */
  isRequired: (fieldId: string) => boolean;
  /** Whether a field is currently soft-required (warns but allows bypass). */
  isSoftRequired: (fieldId: string) => boolean;
  /** Whether a field is currently read-only. Always false until readOnly is fully implemented. */
  isReadOnly: (fieldId: string) => boolean;
  /** Validate a single field and return its errors. */
  getFieldErrors: (fieldId: string) => ValidationError[];
  /** Validate all fields and return all errors. */
  getErrors: () => ValidationError[];
  /** Reconstruct the tree-shaped `FormDefinition` from the flat index. */
  hydrateDefinition: () => FormDefinition;
  /** Produce a flat array of hydrated response items for export / submission. */
  hydrateResponse: (options?: {
    id?: string;
    status?: FormResponse['status'];
    subjectRef?: FormResponse['subjectRef'];
  }) => FormResponse;
}

/** The store handle returned by `createFormStore`. */
export type FormStore = StoreApi<FormState>;

// ---------------------------------------------------------------------------
// Empty normalized definition (used before any definition is loaded).
// ---------------------------------------------------------------------------

const EMPTY_NORMALIZED: NormalizedDefinition = { byId: {}, rootIds: [] };

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Insert `item` into a readonly array at `index` (append if omitted/out of range). */
function insertAt<T>(arr: readonly T[], item: T, index?: number): T[] {
  if (index === undefined || index >= arr.length) return [...arr, item];
  if (index <= 0) return [item, ...arr];
  const result = [...arr];
  result.splice(index, 0, item);
  return result;
}

/** Surgically update one field's definition in the normalized map. */
function patchField(
  normalized: NormalizedDefinition,
  fieldId: string,
  updater: (def: FieldDefinition) => FieldDefinition | null
): NormalizedDefinition | null {
  const node = normalized.byId[fieldId];
  if (!node) return null;
  const newDef = updater(node.definition);
  if (!newDef) return null;
  return {
    ...normalized,
    byId: { ...normalized.byId, [fieldId]: { ...node, definition: newDef } },
  };
}

/** Re-assign `index` on each FieldNode to match array position. Mutates `byId`. */
function reindexChildren(
  byId: Record<string, FieldNode>,
  ids: readonly string[]
): void {
  for (let i = 0; i < ids.length; i++) {
    const node = byId[ids[i]];
    if (node && node.index !== i) {
      byId[ids[i]] = { ...node, index: i };
    }
  }
}

/**
 * Replace all references to `oldId` with `newId` in a single field definition.
 * Handles:
 *  - condition.targetId  (field-condition direct reference)
 *  - condition.expression  (expression language: `{oldId}` → `{newId}`)
 *  - definition.content  (display field inline expressions: `<fn({oldId})>`)
 *  - definition.calculation  (JS: `responses['oldId']` / `responses["oldId"]`)
 */
function rewriteFieldRefs(
  def: FieldDefinition,
  oldId: string,
  newId: string
): FieldDefinition {
  const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exprPattern = new RegExp(`\\{${escaped}\\}`, 'g');
  const jsPatternSingle = new RegExp(`responses\\['${escaped}'\\]`, 'g');
  const jsPatternDouble = new RegExp(`responses\\["${escaped}"\\]`, 'g');

  const replaceExpr = (s: string) => s.replace(exprPattern, `{${newId}}`);
  const replaceJs = (s: string) =>
    s
      .replace(jsPatternSingle, `responses['${newId}']`)
      .replace(jsPatternDouble, `responses["${newId}"]`);

  let changed = false;

  const updatedRules = def.rules?.map((rule) => ({
    ...rule,
    conditions: rule.conditions.map((cond) => {
      let c = cond;
      if (c.targetId === oldId) {
        c = { ...c, targetId: newId };
        changed = true;
      }
      if (c.expression) {
        const next =
          c.conditionType === 'js'
            ? replaceJs(c.expression)
            : replaceExpr(c.expression);
        if (next !== c.expression) {
          c = { ...c, expression: next };
          changed = true;
        }
      }
      return c;
    }),
  }));

  // Update display field content (inline `{fieldId}` expression placeholders)
  const defAny = def as unknown as Record<string, unknown>;
  const content = defAny['content'] as string | undefined;
  const updatedContent = content ? replaceExpr(content) : content;
  if (updatedContent !== content) changed = true;

  // Update calculation (JS)
  const calc = def.calculation;
  const updatedCalc = calc ? replaceJs(calc) : calc;
  if (updatedCalc !== calc) changed = true;

  if (!changed) return def;
  return {
    ...def,
    ...(updatedRules && { rules: updatedRules }),
    ...(updatedContent !== content && { content: updatedContent }),
    ...(updatedCalc !== calc && { calculation: updatedCalc }),
  } as FieldDefinition;
}

/** Recursively collect all descendant field IDs of a section. */
function collectDescendants(
  byId: Readonly<Record<string, FieldNode>>,
  fieldId: string
): string[] {
  const node = byId[fieldId];
  if (!node || node.childIds.length === 0) return [];
  const result: string[] = [];
  for (const childId of node.childIds) {
    result.push(childId);
    result.push(...collectDescendants(byId, childId));
  }
  return result;
}

function getDefaultQuestion(
  fieldType: FieldType,
  label: string
): string | undefined {
  if (
    fieldType === 'section' ||
    fieldType === 'pages' ||
    fieldType === 'html' ||
    fieldType === 'display'
  ) {
    return undefined;
  }
  if (fieldType === 'image') return 'Image Block';
  return `${label} question`;
}

function getDefaultOptionValue(
  fieldType: FieldType,
  index: number,
  total: number
): string {
  if (fieldType === 'boolean') {
    return index === 0 ? 'Yes' : index === 1 ? 'No' : `Option ${index + 1}`;
  }
  if (fieldType === 'rating') return `${index + 1}`;
  if (fieldType === 'slider') {
    if (index === 0) return 'Low';
    if (index === total - 1) return 'High';
    if (total >= 3 && index === Math.floor(total / 2)) return 'Medium';
  }
  if (fieldType === 'multitext') return `Input ${index + 1}`;
  if (fieldType === 'ranking') return `Item ${index + 1}`;
  return `Option ${index + 1}`;
}

// ---------------------------------------------------------------------------
// createFormStore()
// ---------------------------------------------------------------------------

/**
 * Create a new form store.
 *
 * Returns a Zustand vanilla `StoreApi` — call `.getState()` to read,
 * `.setState()` to write, and `.subscribe()` to react to changes.
 *
 * The store uses `NormalizedDefinition` (flat `byId` map) as its source
 * of truth. Builder actions will surgically update entries in `byId` for
 * O(1) edits with minimal re-renders. Use `hydrateDefinition()` to
 * reconstruct the tree when needed (export, Monaco editor).
 *
 * Framework adapters (React `useStore`, Web Component bindings) wrap
 * this store in Phase 5.
 *
 * @param initial - Optional initial form definition to load immediately.
 */
let nextInstanceId = 1;
let nextTemporaryFormId = 1;

function createTemporaryFormId(): string {
  const id = `tmp-form-${nextTemporaryFormId}`;
  nextTemporaryFormId += 1;
  return id;
}

export function createFormStore(
  initial?: FormDefinition,
  hostAllowsJS = false
): FormStore {
  const initialFormId = initial?.id?.trim() || createTemporaryFormId();
  // Sealed at creation time — cannot be overridden by store mutations.
  const _hostAllowsJS = hostAllowsJS;

  const store = createStore<FormState>()((set, get) => ({
    // --- Data ---
    instanceId: `ms-${nextInstanceId++}`,
    formId: initialFormId,
    formTitle: initial?.title,
    formDescription: initial?.description,
    formSourceData: initial?._sourceData,
    dangerouslyAllowJS: (initial?.dangerouslyAllowJS ?? false) && _hostAllowsJS,
    normalized: initial
      ? normalizeDefinition(fieldsFromDefinition(initial))
      : EMPTY_NORMALIZED,
    responses: {},
    userEditedFields: new Set<string>(),

    // --- Actions ---
    loadDefinition: (definition) =>
      set({
        formId: definition.id,
        formTitle: definition.title,
        formDescription: definition.description,
        formSourceData: definition._sourceData,
        dangerouslyAllowJS:
          (definition.dangerouslyAllowJS ?? false) && _hostAllowsJS,
        normalized: normalizeDefinition(fieldsFromDefinition(definition)),
        responses: {},
        userEditedFields: new Set<string>(),
      }),

    setFormId: (id) => {
      const nextId = id.trim();
      if (!nextId) return;
      set({ formId: nextId });
    },

    setFormTitle: (title) => set({ formTitle: title }),

    setFormDescription: (description) => set({ formDescription: description }),

    setDangerouslyAllowJS: (enabled) =>
      set({ dangerouslyAllowJS: enabled && _hostAllowsJS }),

    setResponse: (fieldId, response) =>
      set((state) => {
        const updated = { ...state.responses, [fieldId]: response };
        // Mark this field as user-edited so calculations won't overwrite it
        // (unless the field is explicitly readOnly).
        const nextEdited = new Set(state.userEditedFields);
        nextEdited.add(fieldId);
        if (!state.dangerouslyAllowJS)
          return { responses: updated, userEditedFields: nextEdited };
        // Apply calculations for all fields that have a calculation string
        const calcResponses = { ...updated };
        for (const [calcId, node] of Object.entries(state.normalized.byId)) {
          const calc = (node.definition as { calculation?: string })
            .calculation;
          if (!calc?.trim()) continue;
          // Skip fields the user has manually edited
          if (nextEdited.has(calcId)) continue;
          const result = evaluateJsExpression(
            calc,
            state.normalized,
            calcResponses
          );
          if (result !== null && result !== undefined) {
            calcResponses[calcId] = { answer: String(result) };
          }
        }
        return { responses: calcResponses, userEditedFields: nextEdited };
      }),

    clearResponse: (fieldId) =>
      set((state) => {
        const { [fieldId]: _discarded, ...rest } = state.responses;
        void _discarded;
        return { responses: rest };
      }),

    resetResponses: () =>
      set({ responses: {}, userEditedFields: new Set<string>() }),

    // --- Builder Actions ---
    addField: (fieldType, options) => {
      const meta = getFieldTypeMeta(fieldType);
      if (!meta) return null;

      const { normalized } = get();
      const parentId = options?.parentId ?? null;
      if (parentId && !normalized.byId[parentId]) return null;

      const existingIds = new Set(Object.keys(normalized.byId));
      const patchQuestion = (
        options?.patch as { question?: string } | undefined
      )?.question;
      const id = generateFieldId(
        fieldType,
        existingIds,
        parentId ?? undefined,
        patchQuestion
      );

      // Build definition from registry defaults + caller patch
      const { fields: _nestedFields, ...defaults } = meta.defaultProps;
      void _nestedFields;
      const definition = {
        ...defaults,
        ...options?.patch,
        id,
        fieldType,
      } as FieldDefinition;

      if (!(definition as { question?: string }).question) {
        const defaultQuestion = getDefaultQuestion(fieldType, meta.label);
        if (defaultQuestion) {
          (definition as unknown as Record<string, unknown>).question =
            defaultQuestion;
        }
      }

      // Auto-generate starter options / rows / columns
      const count =
        meta.defaultOptionCount ?? (meta.hasOptions || meta.hasMatrix ? 3 : 0);

      if (
        meta.hasOptions &&
        count > 0 &&
        !(definition as { options?: unknown[] }).options?.length
      ) {
        const opts: FieldOption[] = [];
        const oIds = new Set<string>();
        for (let i = 0; i < count; i++) {
          const oid = generateOptionId(oIds, id);
          oIds.add(oid);
          opts.push({
            id: oid,
            value: getDefaultOptionValue(fieldType, i, count),
          });
        }
        (definition as unknown as Record<string, unknown>).options = opts;
      }

      if (meta.hasMatrix && count > 0) {
        if ((definition as { rows?: unknown[] }).rows === undefined) {
          const rows: MatrixRow[] = [];
          const rIds = new Set<string>();
          for (let i = 0; i < count; i++) {
            const rid = generateRowId(rIds, id);
            rIds.add(rid);
            rows.push({ id: rid, value: `Row ${i + 1}` });
          }
          (definition as unknown as Record<string, unknown>).rows = rows;
        }
        if ((definition as { columns?: unknown[] }).columns === undefined) {
          const cols: MatrixColumn[] = [];
          const cIds = new Set<string>();
          for (let i = 0; i < count; i++) {
            const cid = generateColumnId(cIds, id);
            cIds.add(cid);
            cols.push({ id: cid, value: `Column ${i + 1}` });
          }
          (definition as unknown as Record<string, unknown>).columns = cols;
        }
      }

      // Insert into normalized map
      const byId: Record<string, FieldNode> = { ...normalized.byId };
      let rootIds: readonly string[] = normalized.rootIds;

      if (parentId) {
        const parent = byId[parentId];
        const childIds = insertAt(parent.childIds, id, options?.index);
        byId[parentId] = { ...parent, childIds };
        byId[id] = { definition, parentId, childIds: [], index: 0 };
        reindexChildren(byId, childIds);
      } else {
        rootIds = insertAt(normalized.rootIds, id, options?.index);
        byId[id] = { definition, parentId: null, childIds: [], index: 0 };
        reindexChildren(byId, rootIds);
      }

      set({ normalized: { byId, rootIds } });
      return id;
    },

    updateField: (fieldId, patch) => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;

      const newId = patch['id'] as string | undefined;
      const isRename = newId !== undefined && newId !== fieldId;

      if (isRename) {
        if (normalized.byId[newId!]) return false;

        const newDef = { ...node.definition, ...patch } as FieldDefinition;
        const { [fieldId]: _removed, ...rest } = normalized.byId;
        void _removed;
        const byId: Record<string, FieldNode> = {
          ...rest,
          [newId!]: { ...node, definition: newDef },
        };

        let rootIds = normalized.rootIds;
        if (node.parentId) {
          const parent = byId[node.parentId];
          if (parent) {
            byId[node.parentId] = {
              ...parent,
              childIds: parent.childIds.map((c) =>
                c === fieldId ? newId! : c
              ),
            };
          }
        } else {
          rootIds = rootIds.map((r) => (r === fieldId ? newId! : r));
        }

        // Update children's parentId when renaming a section
        for (const childId of node.childIds) {
          const child = byId[childId];
          if (child) byId[childId] = { ...child, parentId: newId! };
        }

        // Update cross-field references to the renamed ID in all other fields
        for (const otherId of Object.keys(byId)) {
          if (otherId === newId!) continue;
          const other = byId[otherId];
          const rewritten = rewriteFieldRefs(other.definition, fieldId, newId!);
          if (rewritten !== other.definition) {
            byId[otherId] = { ...other, definition: rewritten };
          }
        }

        set({ normalized: { byId, rootIds } });
        return true;
      }

      // Simple patch (no rename)
      const result = patchField(
        normalized,
        fieldId,
        (def) =>
          ({
            ...def,
            ...patch,
          } as FieldDefinition)
      );
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeField: (fieldId) => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;

      const toRemove = new Set([
        fieldId,
        ...collectDescendants(normalized.byId, fieldId),
      ]);

      const byId: Record<string, FieldNode> = {};
      for (const [id, n] of Object.entries(normalized.byId)) {
        if (!toRemove.has(id)) byId[id] = n;
      }

      let rootIds: readonly string[] = normalized.rootIds;
      if (node.parentId && byId[node.parentId]) {
        const parent = byId[node.parentId];
        const childIds = parent.childIds.filter((c) => c !== fieldId);
        byId[node.parentId] = { ...parent, childIds };
        reindexChildren(byId, childIds);
      } else {
        rootIds = rootIds.filter((r) => r !== fieldId);
        reindexChildren(byId, rootIds);
      }

      set({ normalized: { byId, rootIds } });
      return true;
    },

    moveField: (fieldId, toIndex, toParentId) => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;

      const fromParentId = node.parentId;
      const targetParentId =
        toParentId === undefined ? fromParentId : toParentId;

      if (targetParentId === fieldId) return false;
      if (targetParentId && !normalized.byId[targetParentId]) return false;
      if (targetParentId) {
        const desc = collectDescendants(normalized.byId, fieldId);
        if (desc.includes(targetParentId)) return false;
      }

      const byId: Record<string, FieldNode> = { ...normalized.byId };
      let rootIds = [...normalized.rootIds] as string[];

      // Remove from old position
      if (fromParentId && byId[fromParentId]) {
        const parent = byId[fromParentId];
        const childIds = parent.childIds.filter((c) => c !== fieldId);
        byId[fromParentId] = { ...parent, childIds };
        reindexChildren(byId, childIds);
      } else {
        rootIds = rootIds.filter((r) => r !== fieldId);
        reindexChildren(byId, rootIds);
      }

      // Insert at new position
      if (targetParentId) {
        const parent = byId[targetParentId];
        const childIds = insertAt(parent.childIds, fieldId, toIndex);
        byId[targetParentId] = { ...parent, childIds };
        byId[fieldId] = { ...node, parentId: targetParentId };
        reindexChildren(byId, childIds);
      } else {
        rootIds = insertAt(rootIds, fieldId, toIndex) as string[];
        byId[fieldId] = { ...node, parentId: null };
        reindexChildren(byId, rootIds);
      }

      set({ normalized: { byId, rootIds } });
      return true;
    },

    addOption: (fieldId, value = '') => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return null;

      const opts =
        (node.definition as { options?: FieldOption[] }).options ?? [];
      const eIds = new Set(opts.map((o) => o.id));
      const optionId = generateOptionId(eIds, fieldId);

      const result = patchField(
        normalized,
        fieldId,
        (def) =>
          ({
            ...def,
            options: [
              ...((def as unknown as { options?: FieldOption[] }).options ??
                []),
              { id: optionId, value },
            ],
          } as unknown as FieldDefinition)
      );
      if (!result) return null;
      set({ normalized: result });
      return optionId;
    },

    updateOption: (fieldId, optionId, value) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const opts = (def as unknown as { options?: FieldOption[] }).options;
        if (!opts) return null;
        let changed = false;
        const next = opts.map((o) => {
          if (o.id !== optionId) return o;
          if (o.value === value) return o;
          changed = true;
          return { ...o, value };
        });
        return changed
          ? ({ ...def, options: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    setOptionScore: (fieldId, optionId, score) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const opts = (def as unknown as { options?: FieldOption[] }).options;
        if (!opts) return null;
        let changed = false;
        const next = opts.map((o) => {
          if (o.id !== optionId) return o;
          if (o.score === score) return o;
          changed = true;
          if (score === undefined) {
            const { score: _s, ...rest } = o;
            return rest;
          }
          return { ...o, score };
        });
        return changed
          ? ({ ...def, options: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeOption: (fieldId, optionId) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const opts = (def as unknown as { options?: FieldOption[] }).options;
        if (!opts) return null;
        const next = opts.filter((o) => o.id !== optionId);
        return next.length !== opts.length
          ? ({ ...def, options: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    addRow: (fieldId, value = '') => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return null;

      const rows = (node.definition as { rows?: MatrixRow[] }).rows ?? [];
      const eIds = new Set(rows.map((r) => r.id));
      const rowId = generateRowId(eIds, fieldId);

      const result = patchField(
        normalized,
        fieldId,
        (def) =>
          ({
            ...def,
            rows: [
              ...((def as unknown as { rows?: MatrixRow[] }).rows ?? []),
              { id: rowId, value },
            ],
          } as unknown as FieldDefinition)
      );
      if (!result) return null;
      set({ normalized: result });
      return rowId;
    },

    updateRow: (fieldId, rowId, value) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const rows = (def as unknown as { rows?: MatrixRow[] }).rows;
        if (!rows) return null;
        let changed = false;
        const next = rows.map((r) => {
          if (r.id !== rowId) return r;
          if (r.value === value) return r;
          changed = true;
          return { ...r, value };
        });
        return changed
          ? ({ ...def, rows: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeRow: (fieldId, rowId) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const rows = (def as unknown as { rows?: MatrixRow[] }).rows;
        if (!rows) return null;
        const next = rows.filter((r) => r.id !== rowId);
        return next.length !== rows.length
          ? ({ ...def, rows: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    addColumn: (fieldId, value = '') => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return null;

      const cols =
        (node.definition as { columns?: MatrixColumn[] }).columns ?? [];
      const eIds = new Set(cols.map((c) => c.id));
      const colId = generateColumnId(eIds, fieldId);

      const result = patchField(
        normalized,
        fieldId,
        (def) =>
          ({
            ...def,
            columns: [
              ...((def as unknown as { columns?: MatrixColumn[] }).columns ??
                []),
              { id: colId, value },
            ],
          } as unknown as FieldDefinition)
      );
      if (!result) return null;
      set({ normalized: result });
      return colId;
    },

    updateColumn: (fieldId, columnId, value) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const cols = (def as unknown as { columns?: MatrixColumn[] }).columns;
        if (!cols) return null;
        let changed = false;
        const next = cols.map((c) => {
          if (c.id !== columnId) return c;
          if (c.value === value) return c;
          changed = true;
          return { ...c, value };
        });
        return changed
          ? ({ ...def, columns: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    setColumnScore: (fieldId, columnId, score) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const cols = (def as unknown as { columns?: MatrixColumn[] }).columns;
        if (!cols) return null;
        let changed = false;
        const next = cols.map((c) => {
          if (c.id !== columnId) return c;
          if (c.score === score) return c;
          changed = true;
          if (score === undefined) {
            const { score: _s, ...rest } = c;
            return rest;
          }
          return { ...c, score };
        });
        return changed
          ? ({ ...def, columns: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeColumn: (fieldId, columnId) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const cols = (def as unknown as { columns?: MatrixColumn[] }).columns;
        if (!cols) return null;
        const next = cols.filter((c) => c.id !== columnId);
        return next.length !== cols.length
          ? ({ ...def, columns: next } as unknown as FieldDefinition)
          : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    // --- Selectors ---
    getField: (fieldId) => get().normalized.byId[fieldId],

    getResponse: (fieldId) => get().responses[fieldId],

    isVisible: (fieldId) => {
      const { normalized, responses, dangerouslyAllowJS } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      return resolveEffect(
        'visible',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS
      );
    },

    isEnabled: (fieldId) => {
      const { normalized, responses, dangerouslyAllowJS } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      return resolveEffect(
        'enable',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS
      );
    },

    isRequired: (fieldId) => {
      const { normalized, responses, dangerouslyAllowJS } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      if (node.definition.required === 'soft') return false; // soft is handled by isSoftRequired
      return resolveEffect(
        'required',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS
      );
    },

    isSoftRequired: (fieldId) => {
      const { normalized, responses, dangerouslyAllowJS } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      if (node.definition.required !== 'soft') return false;
      return resolveEffect(
        'required',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS
      );
    },

    isReadOnly: (_fieldId) => {
      // readOnly is not yet implemented — always returns false.
      // TODO: implement readOnly properly (see INTERNAL-TICKETS/readonly-fields.md)
      return false;
    },

    getFieldErrors: (fieldId) => {
      const { normalized, responses, dangerouslyAllowJS } = get();
      return validateField(fieldId, normalized, responses, dangerouslyAllowJS);
    },

    getErrors: () => {
      const { normalized, responses, dangerouslyAllowJS } = get();
      return validateForm(normalized, responses, dangerouslyAllowJS);
    },

    hydrateDefinition: () => {
      const {
        normalized,
        formId,
        formTitle,
        formDescription,
        formSourceData,
        dangerouslyAllowJS,
      } = get();

      const base = {
        id: formId,
        ...(formTitle !== undefined && { title: formTitle }),
        ...(formDescription !== undefined && { description: formDescription }),
        ...(dangerouslyAllowJS && { dangerouslyAllowJS: true }),
        ...(formSourceData !== undefined && { _sourceData: formSourceData }),
      };

      // When every root field is a pages field, output the first-class `pages`
      // array format. This is now always the case since FormDefinition requires pages.
      const allRootsArePages =
        normalized.rootIds.length > 0 &&
        normalized.rootIds.every(
          (id) => normalized.byId[id]?.definition.fieldType === 'pages'
        );

      if (allRootsArePages) {
        const pages = normalized.rootIds.map((id) => {
          const node = normalized.byId[id];
          const def = node.definition as {
            title?: string;
            autoAdvance?: boolean;
          };
          const childFields = hydrateDefinition({
            byId: normalized.byId,
            rootIds: node.childIds,
          });
          return {
            id,
            ...(def.title !== undefined && { title: def.title }),
            ...(def.autoAdvance !== undefined && {
              autoAdvance: def.autoAdvance,
            }),
            ...(childFields.length > 0 && { fields: childFields }),
          };
        });
        return { ...base, pages } as FormDefinition;
      }

      // Fallback: wrap any non-pages root fields in a single default page.
      const rootFields = hydrateDefinition(normalized);
      return {
        ...base,
        pages:
          rootFields.length > 0 ? [{ id: 'page-1', fields: rootFields }] : [],
      } as FormDefinition;
    },

    hydrateResponse: (options) => {
      const { normalized, responses, formId } = get();
      return hydrateResponse(normalized, responses, {
        definitionId: formId,
        ...options,
      });
    },
  }));

  // Prevent external setState bypass: store.setState({ dangerouslyAllowJS: true })
  // Internal set() calls in actions close over the original setState and are unaffected.
  const _origSetState = store.setState.bind(store);
  store.setState = (partial, replace?) => {
    const resolved =
      typeof partial === 'function' ? partial(store.getState()) : partial;
    if (
      resolved !== null &&
      typeof resolved === 'object' &&
      'dangerouslyAllowJS' in resolved
    ) {
      (resolved as Record<string, unknown>)['dangerouslyAllowJS'] =
        Boolean((resolved as Record<string, unknown>)['dangerouslyAllowJS']) &&
        _hostAllowsJS;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _origSetState(resolved as any, replace as any);
  };

  return store;
}
