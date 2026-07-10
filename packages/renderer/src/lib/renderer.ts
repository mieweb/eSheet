import {
  normalizeDefinition,
  resolveEffect,
  resolveSetValue,
  type FieldDefinition,
  type FormDefinition,
  type FormResponse,
  type FieldResponse,
} from '@esheet/core';

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
 * Build a render tree from form definition + responses.
 *
 * Sections are represented as nodes with nested `children`.
 * Computed values from setValue effects are included in computedValue field.
 */
export function renderer(
  definition: FormDefinition,
  responses: FormResponse = {},
  options: RenderTreeOptions = {}
): RenderFieldNode[] {
  const normalized = normalizeDefinition(
    definition.pages.flatMap((p) => p.fields ?? [])
  );
  const includeHidden = options.includeHidden === true;
  // Both the host option AND the schema flag must be true.
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

  return build(normalized.rootIds);
}

/** Alias for readability in consumers that prefer explicit naming. */
export const buildRenderTree = renderer;

/**
 * Apply computed values from a render tree to a responses object.
 *
 * Iterates through the render tree and merges any computed values
 * (from setValue effects) into the responses map. Wraps string/number
 * values as FieldResponse answer objects.
 *
 * @param tree - Render tree with computed values.
 * @param responses - Base responses object to merge into (is modified in-place).
 * @returns Updated responses object.
 */
export function applyComputedValues(
  tree: RenderFieldNode[],
  responses: FormResponse = {}
): FormResponse {
  const walk = (nodes: RenderFieldNode[]) => {
    for (const node of nodes) {
      if (node.computedValue !== undefined && node.computedValue !== null) {
        // Wrap computed value in FieldResponse answer property
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
