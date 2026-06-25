// ---------------------------------------------------------------------------
// Effect Resolution — resolve conditional effects for a field
// ---------------------------------------------------------------------------

import type {
  ConditionalEffect,
  FieldDefinition,
  FieldResponseMap,
} from '../types.js';
import type { NormalizedDefinition } from '../functions/normalize.js';
import { evaluateRule } from './conditions.js';

// ---------------------------------------------------------------------------
// resolveEffect()
// ---------------------------------------------------------------------------

/** Default value when no matching rule exists for a given effect. */
const EFFECT_DEFAULTS: Record<ConditionalEffect, boolean> = {
  visible: true,
  enable: true,
  required: false,
  readOnly: false,
};

/**
 * Resolve a conditional effect for a single field.
 *
 * Filters the field's `rules` to those matching `effect`, evaluates each
 * against the current form state, then combines results:
 *
 * - **No matching rules** → returns the static default for the effect.
 *   For `'required'`, falls back to `field.required ?? false`.
 *   For `'visible'` / `'enable'`, defaults to `true`.
 *
 * - **One or more matching rules** → returns `true` if **any** rule
 *   evaluates to `true` (OR across rules). This means a single passing
 *   rule is enough to make the field visible / enabled / required.
 *
 * @param effect     - Which effect to resolve (`'visible'`, `'enable'`, `'required'`).
 * @param field      - The field definition (must include `rules` and `required`).
 * @param normalized - The normalized form definition (flat `byId` map).
 * @param responses  - The current form responses.
 */
export function resolveEffect(
  effect: ConditionalEffect,
  field: Pick<FieldDefinition, 'rules'> & {
    required?: boolean | 'soft';
    readOnly?: boolean;
  },
  normalized: NormalizedDefinition,
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean,
  contextData?: Record<string, unknown>
): boolean {
  // For effects backed by a static value on the field definition
  // (required, readOnly), the static value is the gatekeeper:
  //
  //   toggle OFF  → effect never applies, rules are ignored
  //   toggle ON + no rules → effect always applies
  //   toggle ON + rules    → effect applies only when any rule matches
  //
  // Note: for 'required', both true (hard) and 'soft' count as ON.
  // Use resolveRequiredSeverity() to distinguish hard vs soft.
  //
  if (effect === 'required' || effect === 'readOnly') {
    const staticOn =
      effect === 'required'
        ? !!field.required // true for both `true` and `'soft'`
        : field.readOnly ?? false;

    if (!staticOn) return false;

    const rules = field.rules?.filter((r) => r.effect === effect);
    if (!rules || rules.length === 0) return true;
    return rules.some((rule) =>
      evaluateRule(rule, normalized, responses, dangerouslyAllowJS, contextData)
    );
  }

  // visible / enable — no static field property; rules fully control, default from EFFECT_DEFAULTS
  const rules = field.rules?.filter((r) => r.effect === effect);
  if (!rules || rules.length === 0) return EFFECT_DEFAULTS[effect];
  return rules.some((rule) =>
    evaluateRule(rule, normalized, responses, dangerouslyAllowJS, contextData)
  );
}

/**
 * Check whether a field is effectively active after considering its own
 * visibility/enabled rules and those of all ancestor sections.
 */
export function isFieldEffectivelyActive(
  fieldId: string,
  normalized: NormalizedDefinition,
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean,
  contextData?: Record<string, unknown>
): boolean {
  let currentId: string | null = fieldId;

  while (currentId) {
    const node: NormalizedDefinition['byId'][string] | undefined =
      normalized.byId[currentId];
    if (!node) return false;

    if (
      !resolveEffect(
        'visible',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS,
        contextData
      )
    ) {
      return false;
    }

    if (
      !resolveEffect(
        'enable',
        node.definition,
        normalized,
        responses,
        dangerouslyAllowJS,
        contextData
      )
    ) {
      return false;
    }

    currentId = node.parentId;
  }

  return true;
}

/**
 * Resolve the severity of the `required` effect for a field.
 *
 * Returns `'soft'` when `field.required === 'soft'`, otherwise `'hard'`.
 * Only meaningful to call after confirming the field is actually required
 * (via {@link resolveEffect}).
 */
export function resolveRequiredSeverity(
  field: Pick<FieldDefinition, 'required'>
): 'hard' | 'soft' {
  return (field as { required?: boolean | 'soft' }).required === 'soft'
    ? 'soft'
    : 'hard';
}
