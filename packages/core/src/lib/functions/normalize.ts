// ---------------------------------------------------------------------------
// Normalization — tree → flat indexed map
// ---------------------------------------------------------------------------

import type { FieldDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A field definition wrapped with tree-position metadata. */
export interface FieldNode {
  /** The field definition (without nested `fields` — children are tracked via `childIds`). */
  readonly definition: Omit<FieldDefinition, 'fields'>;
  /** Parent section ID, or `null` for top-level fields. */
  readonly parentId: string | null;
  /** Ordered child field IDs (non-empty only for sections). */
  readonly childIds: readonly string[];
  /** Position among siblings (0-based). */
  readonly index: number;
}

/** The result of normalizing a field tree into a flat indexed map. */
export interface NormalizedDefinition {
  /** Every field keyed by ID — sections and their children alike. */
  readonly byId: Readonly<Record<string, FieldNode>>;
  /** Ordered top-level field IDs (rendering order). */
  readonly rootIds: readonly string[];
}

// ---------------------------------------------------------------------------
// normalizeDefinition()
// ---------------------------------------------------------------------------

/**
 * Flatten a tree of `FieldDefinition`s into a `NormalizedDefinition`.
 *
 * Every field (including section children) gets its own entry in `byId`,
 * linked by `parentId` / `childIds`. The original nested `fields` array
 * is stripped from the stored definition — use `childIds` instead.
 *
 * @param fields - Top-level field definitions (e.g. `FormSchema.fields`).
 */
export function normalizeDefinition(
  fields: readonly FieldDefinition[]
): NormalizedDefinition {
  const byId: Record<string, FieldNode> = {};
  const rootIds: string[] = [];

  function walk(
    defs: readonly FieldDefinition[],
    parentId: string | null
  ): string[] {
    const ids: string[] = [];

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const { fields: children, ...rest } = def;

      const childIds =
        def.fieldType === 'section' && Array.isArray(children)
          ? walk(children, def.id)
          : [];

      byId[def.id] = {
        definition: rest,
        parentId,
        childIds,
        index: i,
      };

      ids.push(def.id);
    }

    return ids;
  }

  rootIds.push(...walk(fields, null));

  return { byId, rootIds };
}

// ---------------------------------------------------------------------------
// hydrateDefinition()
// ---------------------------------------------------------------------------

/**
 * Reconstruct a tree of `FieldDefinition`s from a `NormalizedDefinition`.
 *
 * This is the inverse of `normalizeDefinition`. It walks `rootIds` (and
 * each section's `childIds`) to rebuild the nested `fields` arrays.
 *
 * @param normalized - The flat indexed form produced by `normalizeDefinition`.
 */
export function hydrateDefinition(
  normalized: NormalizedDefinition
): FieldDefinition[] {
  function build(ids: readonly string[]): FieldDefinition[] {
    return ids.map((id) => {
      const node = normalized.byId[id];
      if (!node) return { id, fieldType: 'text' } as FieldDefinition;

      const def = { ...node.definition } as FieldDefinition;
      if (node.childIds.length > 0) {
        def.fields = build(node.childIds);
      }
      return def;
    });
  }

  return build(normalized.rootIds);
}
