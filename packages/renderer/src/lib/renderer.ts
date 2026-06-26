import {
  normalizeDefinition,
  resolveEffect,
  type FieldDefinition,
  type FormDefinition,
  type FormResponse,
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
  /** Renderable child nodes (sections only). */
  children: RenderFieldNode[];
}

/**
 * Build a render tree from form definition + responses.
 *
 * Sections are represented as nodes with nested `children`.
 */
export function renderer(
  definition: FormDefinition,
  responses: FormResponse = {},
  options: RenderTreeOptions = {}
): RenderFieldNode[] {
  const normalized = normalizeDefinition(definition.fields);
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
        children: build(node.childIds),
      });
    }

    return result;
  }

  return build(normalized.rootIds);
}

/** Alias for readability in consumers that prefer explicit naming. */
export const buildRenderTree = renderer;
