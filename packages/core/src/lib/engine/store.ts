// ---------------------------------------------------------------------------
// Engine Store — Zustand vanilla store for form state management
// ---------------------------------------------------------------------------

import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type {
  FormDefinition,
  FormResponse,
  FieldResponse,
  FieldDefinition,
  FieldType,
  FieldOption,
  MatrixRow,
  MatrixColumn,
} from '../types.js';
import { SCHEMA_TYPE } from '../types.js';
import { getFieldTypeMeta } from '../registry.js';
import {
  generateFieldId,
  generateOptionId,
  generateRowId,
  generateColumnId,
} from '../functions/ids.js';
import type {
  NormalizedDefinition,
  FieldNode,
} from '../functions/normalize.js';
import {
  normalizeDefinition,
  hydrateDefinition,
} from '../functions/normalize.js';
import { hydrateResponse } from '../functions/hydrate-response.js';
import type { HydratedResponseItem } from '../functions/hydrate-response.js';
import { resolveEffect } from '../logic/resolve.js';
import { validateField, validateForm } from '../logic/validate.js';
import type { ValidationError } from '../logic/validate.js';

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
  patch?: Partial<Omit<FieldDefinition, 'id' | 'fieldType' | 'fields'>>;
}

/** The full engine state — data + actions + selectors. */
export interface FormEngineState {
  // --- Data ---
  /** Flat-indexed map — the source of truth for field structure. */
  readonly normalized: NormalizedDefinition;
  /** Current responses keyed by field ID. */
  readonly responses: FormResponse;

  // --- Lifecycle Actions ---
  /** Load a form definition (tree), normalizing it into the flat index. */
  loadDefinition: (definition: FormDefinition) => void;
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
  updateField: (fieldId: string, patch: Partial<Omit<FieldDefinition, 'fields'>>) => boolean;
  /** Remove a field (and its children if it is a section). */
  removeField: (fieldId: string) => boolean;
  /** Move a field to a new position/parent. `toParentId` defaults to current parent; pass `null` for root. */
  moveField: (fieldId: string, toIndex: number, toParentId?: string | null) => boolean;
  /** Add an option. Returns the generated option ID. */
  addOption: (fieldId: string, value?: string) => string | null;
  /** Update an option's value. */
  updateOption: (fieldId: string, optionId: string, value: string) => boolean;
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
  /** Whether a field is currently required. */
  isRequired: (fieldId: string) => boolean;
  /** Validate a single field and return its errors. */
  getFieldErrors: (fieldId: string) => ValidationError[];
  /** Validate all fields and return all errors. */
  getErrors: () => ValidationError[];
  /** Reconstruct the tree-shaped `FormDefinition` from the flat index. */
  hydrateDefinition: () => FormDefinition;
  /** Produce a flat array of hydrated response items for export / submission. */
  hydrateResponse: () => HydratedResponseItem[];
}

/** The engine store handle returned by `createFormEngine`. */
export type FormEngine = StoreApi<FormEngineState>;

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
  updater: (
    def: Omit<FieldDefinition, 'fields'>,
  ) => Omit<FieldDefinition, 'fields'> | null,
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
  ids: readonly string[],
): void {
  for (let i = 0; i < ids.length; i++) {
    const node = byId[ids[i]];
    if (node && node.index !== i) {
      byId[ids[i]] = { ...node, index: i };
    }
  }
}

/** Recursively collect all descendant field IDs of a section. */
function collectDescendants(
  byId: Readonly<Record<string, FieldNode>>,
  fieldId: string,
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

// ---------------------------------------------------------------------------
// createFormEngine()
// ---------------------------------------------------------------------------

/**
 * Create a new form engine store.
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
export function createFormEngine(initial?: FormDefinition): FormEngine {
  return createStore<FormEngineState>()((set, get) => ({
    // --- Data ---
    normalized: initial
      ? normalizeDefinition(initial.fields)
      : EMPTY_NORMALIZED,
    responses: {},

    // --- Actions ---
    loadDefinition: (definition) =>
      set({
        normalized: normalizeDefinition(definition.fields),
        responses: {},
      }),

    setResponse: (fieldId, response) =>
      set((state) => ({
        responses: { ...state.responses, [fieldId]: response },
      })),

    clearResponse: (fieldId) =>
      set((state) => {
        const { [fieldId]: _, ...rest } = state.responses;
        return { responses: rest };
      }),

    resetResponses: () => set({ responses: {} }),

    // --- Builder Actions ---
    addField: (fieldType, options) => {
      const meta = getFieldTypeMeta(fieldType);
      if (!meta) return null;

      const { normalized } = get();
      const parentId = options?.parentId ?? null;
      if (parentId && !normalized.byId[parentId]) return null;

      const existingIds = new Set(Object.keys(normalized.byId));
      const id = generateFieldId(fieldType, existingIds, parentId ?? undefined);

      // Build definition from registry defaults + caller patch
      const { fields: _nested, ...defaults } = meta.defaultProps;
      const definition = {
        ...defaults,
        ...options?.patch,
        id,
        fieldType,
      } as Omit<FieldDefinition, 'fields'>;

      // Auto-generate starter options / rows / columns
      const count =
        meta.defaultOptionCount ?? (meta.hasOptions || meta.hasMatrix ? 3 : 0);

      if (meta.hasOptions && count > 0 && !definition.options?.length) {
        const opts: FieldOption[] = [];
        const oIds = new Set<string>();
        for (let i = 0; i < count; i++) {
          const oid = generateOptionId(oIds, id);
          oIds.add(oid);
          opts.push({ id: oid, value: '' });
        }
        (definition as Record<string, unknown>).options = opts;
      }

      if (meta.hasMatrix && count > 0) {
        if (!definition.rows?.length) {
          const rows: MatrixRow[] = [];
          const rIds = new Set<string>();
          for (let i = 0; i < count; i++) {
            const rid = generateRowId(rIds, id);
            rIds.add(rid);
            rows.push({ id: rid, value: '' });
          }
          (definition as Record<string, unknown>).rows = rows;
        }
        if (!definition.columns?.length) {
          const cols: MatrixColumn[] = [];
          const cIds = new Set<string>();
          for (let i = 0; i < count; i++) {
            const cid = generateColumnId(cIds, id);
            cIds.add(cid);
            cols.push({ id: cid, value: '' });
          }
          (definition as Record<string, unknown>).columns = cols;
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

      const newId = patch.id;
      const isRename = newId !== undefined && newId !== fieldId;

      if (isRename) {
        if (normalized.byId[newId!]) return false;

        const newDef = { ...node.definition, ...patch };
        const { [fieldId]: _, ...rest } = normalized.byId;
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
                c === fieldId ? newId! : c,
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

        set({ normalized: { byId, rootIds } });
        return true;
      }

      // Simple patch (no rename)
      const result = patchField(normalized, fieldId, (def) => ({
        ...def,
        ...patch,
      }));
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

      const opts = node.definition.options ?? [];
      const eIds = new Set(opts.map((o) => o.id));
      const optionId = generateOptionId(eIds, fieldId);

      const result = patchField(normalized, fieldId, (def) => ({
        ...def,
        options: [...(def.options ?? []), { id: optionId, value }],
      }));
      if (!result) return null;
      set({ normalized: result });
      return optionId;
    },

    updateOption: (fieldId, optionId, value) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const opts = def.options;
        if (!opts) return null;
        let changed = false;
        const next = opts.map((o) => {
          if (o.id !== optionId) return o;
          if (o.value === value) return o;
          changed = true;
          return { ...o, value };
        });
        return changed ? { ...def, options: next } : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeOption: (fieldId, optionId) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const opts = def.options;
        if (!opts) return null;
        const next = opts.filter((o) => o.id !== optionId);
        return next.length !== opts.length ? { ...def, options: next } : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    addRow: (fieldId, value = '') => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return null;

      const rows = node.definition.rows ?? [];
      const eIds = new Set(rows.map((r) => r.id));
      const rowId = generateRowId(eIds, fieldId);

      const result = patchField(normalized, fieldId, (def) => ({
        ...def,
        rows: [...(def.rows ?? []), { id: rowId, value }],
      }));
      if (!result) return null;
      set({ normalized: result });
      return rowId;
    },

    updateRow: (fieldId, rowId, value) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const rows = def.rows;
        if (!rows) return null;
        let changed = false;
        const next = rows.map((r) => {
          if (r.id !== rowId) return r;
          if (r.value === value) return r;
          changed = true;
          return { ...r, value };
        });
        return changed ? { ...def, rows: next } : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeRow: (fieldId, rowId) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const rows = def.rows;
        if (!rows) return null;
        const next = rows.filter((r) => r.id !== rowId);
        return next.length !== rows.length ? { ...def, rows: next } : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    addColumn: (fieldId, value = '') => {
      const { normalized } = get();
      const node = normalized.byId[fieldId];
      if (!node) return null;

      const cols = node.definition.columns ?? [];
      const eIds = new Set(cols.map((c) => c.id));
      const colId = generateColumnId(eIds, fieldId);

      const result = patchField(normalized, fieldId, (def) => ({
        ...def,
        columns: [...(def.columns ?? []), { id: colId, value }],
      }));
      if (!result) return null;
      set({ normalized: result });
      return colId;
    },

    updateColumn: (fieldId, columnId, value) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const cols = def.columns;
        if (!cols) return null;
        let changed = false;
        const next = cols.map((c) => {
          if (c.id !== columnId) return c;
          if (c.value === value) return c;
          changed = true;
          return { ...c, value };
        });
        return changed ? { ...def, columns: next } : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    removeColumn: (fieldId, columnId) => {
      const result = patchField(get().normalized, fieldId, (def) => {
        const cols = def.columns;
        if (!cols) return null;
        const next = cols.filter((c) => c.id !== columnId);
        return next.length !== cols.length ? { ...def, columns: next } : null;
      });
      if (!result) return false;
      set({ normalized: result });
      return true;
    },

    // --- Selectors ---
    getField: (fieldId) => get().normalized.byId[fieldId],

    getResponse: (fieldId) => get().responses[fieldId],

    isVisible: (fieldId) => {
      const { normalized, responses } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      return resolveEffect('visible', node.definition, normalized, responses);
    },

    isEnabled: (fieldId) => {
      const { normalized, responses } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      return resolveEffect('enable', node.definition, normalized, responses);
    },

    isRequired: (fieldId) => {
      const { normalized, responses } = get();
      const node = normalized.byId[fieldId];
      if (!node) return false;
      return resolveEffect('required', node.definition, normalized, responses);
    },

    getFieldErrors: (fieldId) => {
      const { normalized, responses } = get();
      return validateField(fieldId, normalized, responses);
    },

    getErrors: () => {
      const { normalized, responses } = get();
      return validateForm(normalized, responses);
    },

    hydrateDefinition: () => {
      const { normalized } = get();
      return {
        schemaType: SCHEMA_TYPE,
        fields: hydrateDefinition(normalized),
      };
    },

    hydrateResponse: () => {
      const { normalized, responses } = get();
      return hydrateResponse(normalized, responses);
    },
  }));
}
