import { normalizeDefinition } from './normalize.js';
import { resolveEffect, resolveSetValue } from '../logic/resolve.js';
import type {
  FieldDefinition,
  FormDefinition,
  FieldResponseMap,
  FieldResponse,
} from '../types.js';

export interface RenderTreeOptions {
  /** Include fields that resolve to invisible (default: false). */
  includeHidden?: boolean;
  /**
   * Opt-in to allow dangerous JS execution. When `false` (default), any
   * `dangerouslyAllowJS: true` in the schema is ignored — JS conditions always
   * return `false`. Only set to `true` when you trust the schema content.
   */
  allowDangerousJS?: boolean;
}

export interface RenderFieldNode {
  /** Field identifier. */
  id: string;
  /** Field definition without nested children. */
  definition: Omit<FieldDefinition, 'fields'>;
  /** Computed visible state. */
  visible: boolean;
  /** Computed enabled state. */
  enabled: boolean;
  /** Computed required state. */
  required: boolean;
  /** Computed value from setValue effects (if any). */
  computedValue?: string | number | null;
  /** Renderable child nodes (sections only). */
  children: RenderFieldNode[];
}

/**
 * Build a render tree from a form definition + responses.
 *
 * Pure function — no React, no UI. Evaluates conditional visibility,
 * enabled, required, and setValue effects for every field and returns
 * a flat-to-nested tree of `RenderFieldNode` objects.
 *
 * Sections are represented as nodes with nested `children`.
 */
export function buildRenderTree(
  definition: FormDefinition,
  responses: FieldResponseMap = {},
  options: RenderTreeOptions = {}
): RenderFieldNode[] {
  const normalized = normalizeDefinition(definition.pages);
  const includeHidden = options.includeHidden === true;
  const dangerouslyAllowJS =
    options.allowDangerousJS === true && definition.dangerouslyAllowJS === true;

  function build(ids: readonly string[]): RenderFieldNode[] {
    const result: RenderFieldNode[] = [];

    for (const id of ids) {
      const node = normalized.byId[id];
      if (!node) continue;

      const visible = resolveEffect(
        'visible',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS
      );
      if (!visible && !includeHidden) continue;

      const computedValue = resolveSetValue(
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS
      );

      result.push({
        id,
        definition: node.definition,
        visible,
        enabled: resolveEffect(
          'enable',
          node.definition,
          normalized,
          responses,
          dangerouslyAllowJS
        ),
        required: resolveEffect(
          'required',
          node.definition,
          normalized,
          responses,
          dangerouslyAllowJS
        ),
        computedValue: computedValue ?? undefined,
        children: build(node.childIds),
      });
    }

    return result;
  }

  return normalized.pages.flatMap((page) => build(page.fieldIds));
}

/**
 * Apply computed values from a render tree back into a responses map.
 *
 * Iterates the tree and merges any `computedValue` entries (from setValue
 * effects) into the provided responses object. Modifies in place and returns
 * it for convenience.
 */
export function applyComputedValues(
  tree: RenderFieldNode[],
  responses: FieldResponseMap = {}
): FieldResponseMap {
  const walk = (nodes: RenderFieldNode[]) => {
    for (const node of nodes) {
      if (node.computedValue !== undefined && node.computedValue !== null) {
        const fieldResponse: FieldResponse = {
          answer: String(node.computedValue),
        };
        responses[node.id] = fieldResponse;
      }
      walk(node.children);
    }
  };
  walk(tree);
  return responses;
}
