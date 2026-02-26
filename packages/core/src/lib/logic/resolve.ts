// ---------------------------------------------------------------------------
// Effect Resolution — resolve conditional effects for a field
// ---------------------------------------------------------------------------

import type {
  ConditionalEffect,
  FieldDefinition,
  FormResponse,
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
  field: Pick<FieldDefinition, 'rules' | 'required'>,
  normalized: NormalizedDefinition,
  responses: FormResponse,
): boolean {
  const rules = field.rules?.filter((r) => r.effect === effect);

  if (!rules || rules.length === 0) {
    return effect === 'required'
      ? field.required ?? false
      : EFFECT_DEFAULTS[effect];
  }

  return rules.some((rule) => evaluateRule(rule, normalized, responses));
}
