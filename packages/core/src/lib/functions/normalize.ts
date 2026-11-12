// ---------------------------------------------------------------------------
// Normalization — tree → flat indexed map
// ---------------------------------------------------------------------------

import type {
  FieldDefinition,
  FieldWidth,
  PageEntry,
  SectionFieldDefinition,
} from '../types.js';
import { getFieldTypeMeta } from '../registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A field definition wrapped with tree-position metadata. */
export interface FieldNode {
  /** The field definition (without nested `fields` — children are tracked via `childIds`). */
  readonly definition: FieldDefinition;
  /** Parent section ID, or `null` for page-root fields. */
  readonly parentId: string | null;
  /** Ordered child field IDs (non-empty only for sections). */
  readonly childIds: readonly string[];
  /** Position among siblings (0-based). */
  readonly index: number;
}

/** A page in the normalized form — stores ordered field IDs rather than nested definitions. */
export interface NormalizedPage {
  readonly id: string;
  readonly title?: string;
  readonly autoAdvance?: boolean;
  /** Ordered top-level field IDs on this page. */
  readonly fieldIds: readonly string[];
}

/** The result of normalizing a form definition into a flat indexed map. */
export interface NormalizedDefinition {
  /** Every field keyed by ID — sections and their children alike. Pages are NOT stored here. */
  readonly byId: Readonly<Record<string, FieldNode>>;
  /** Ordered pages. Each page holds ordered top-level field IDs. */
  readonly pages: readonly NormalizedPage[];
}

// ---------------------------------------------------------------------------
// normalizeDefinition()
// ---------------------------------------------------------------------------

/**
 * Flatten a form's pages (and their nested fields) into a `NormalizedDefinition`.
 *
 * Every field (including section children) gets its own entry in `byId`,
 * linked by `parentId` / `childIds`. Pages are stored in the `pages` array —
 * they are not fields and do not appear in `byId`.
 *
 * @param pages - The `pages` array from a `FormDefinition`.
 */
export function normalizeDefinition(
  pages: readonly PageEntry[]
): NormalizedDefinition {
  const byId: Record<string, FieldNode> = {};

  function walk(
    defs: readonly FieldDefinition[],
    parentId: string | null
  ): string[] {
    const ids: string[] = [];
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const { fields: children, ...rest } = def as SectionFieldDefinition;
      const { fields: _defaultFields, ...defaultProps } =
        getFieldTypeMeta(def.fieldType)?.defaultProps ?? {};
      void _defaultFields;
      const definition = { ...rest } as FieldDefinition;
      const definitionValues = definition as unknown as Record<string, unknown>;
      for (const [property, value] of Object.entries(defaultProps)) {
        if (definitionValues[property] === undefined)
          definitionValues[property] = value;
      }
      const childIds =
        def.fieldType === 'section' && Array.isArray(children)
          ? walk(children, def.id)
          : [];
      byId[def.id] = {
        definition,
        parentId,
        childIds,
        index: i,
      };
      ids.push(def.id);
    }
    return ids;
  }

  const normalizedPages: NormalizedPage[] = pages.map((page) => {
    const fieldIds = page.fields ? walk(page.fields, null) : [];
    return {
      id: page.id,
      ...(page.title !== undefined && { title: page.title }),
      ...(page.autoAdvance !== undefined && { autoAdvance: page.autoAdvance }),
      fieldIds,
    };
  });

  return { byId, pages: normalizedPages };
}

/** Resolve the nearest defined section width for a field. */
export function getInheritedSectionWidth(
  normalized: NormalizedDefinition,
  fieldId: string
): FieldWidth | undefined {
  if (normalized.byId[fieldId]?.definition.overrideSectionWidth === true) {
    return undefined;
  }

  let parentId = normalized.byId[fieldId]?.parentId;

  while (parentId) {
    const parent = normalized.byId[parentId];
    if (!parent) return undefined;

    if (
      parent.definition.fieldType === 'section' &&
      parent.definition.width !== undefined &&
      parent.definition.width !== 'none'
    ) {
      return parent.definition.width;
    }

    parentId = parent.parentId;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// hydrateDefinition()
// ---------------------------------------------------------------------------

/**
 * Reconstruct a `PageEntry[]` from a `NormalizedDefinition`.
 *
 * This is the inverse of `normalizeDefinition`. It walks each page's `fieldIds`
 * (and each section's `childIds`) to rebuild the nested `fields` arrays.
 *
 * @param normalized - The flat indexed form produced by `normalizeDefinition`.
 */
export function hydrateDefinition(
  normalized: NormalizedDefinition
): PageEntry[] {
  function build(ids: readonly string[]): FieldDefinition[] {
    return ids.map((id) => {
      const node = normalized.byId[id];
      if (!node) return { id, fieldType: 'text' } as FieldDefinition;
      const def = { ...node.definition } as FieldDefinition & {
        fields?: FieldDefinition[];
      };
      if (node.childIds.length > 0) {
        def.fields = build(node.childIds);
      }
      return def;
    });
  }

  return normalized.pages.map((page) => ({
    id: page.id,
    ...(page.title !== undefined && { title: page.title }),
    ...(page.autoAdvance !== undefined && { autoAdvance: page.autoAdvance }),
    ...(page.fieldIds.length > 0 && { fields: build(page.fieldIds) }),
  }));
}
