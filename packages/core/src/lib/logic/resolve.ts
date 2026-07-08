// ---------------------------------------------------------------------------
// Effect Resolution — resolve conditional effects for a field
// ---------------------------------------------------------------------------

import type {
  ConditionalEffect,
  FieldDefinition,
  FieldResponseMap,
} from '../types.js';
import type { NormalizedDefinition } from '../functions/normalize.js';
import { evaluateRule, evaluateExpression } from './conditions.js';

// ---------------------------------------------------------------------------
// Effect Handlers & Dispatcher
// ---------------------------------------------------------------------------

/** Default value when no matching rule exists for a given boolean effect. */
const BOOLEAN_EFFECT_DEFAULTS: Record<
  'visible' | 'enable' | 'required',
  boolean
> = {
  visible: true,
  enable: true,
  required: false,
};

/**
 * Resolve a boolean effect (visible, enable, required).
 *
 * For effects backed by a static field property (required),
 * the static value gates whether rules apply.
 * For visibility/enable effects, rules fully control the outcome.
 */
function resolveBooleanEffect(
  effect: 'visible' | 'enable' | 'required',
  field: Pick<FieldDefinition, 'rules'> & {
    required?: boolean | 'soft';
  },
  normalized: NormalizedDefinition,
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean
): boolean {
  // For required — static field property gates whether rules apply:
  //   toggle OFF  → effect never applies, rules are ignored
  //   toggle ON + no rules → effect always applies
  //   toggle ON + rules    → effect applies only when any rule matches
  if (effect === 'required') {
    const staticValue = !!field.required; // true for both `true` and `'soft'`
    const rules = field.rules?.filter((r) => r.effect === effect);
    if (!rules || rules.length === 0 || !staticValue) return staticValue;
    // When toggle is ON and rules exist, rules narrow down when effect applies.
    return rules.some((rule) =>
      evaluateRule(rule, normalized, responses, dangerouslyAllowJS)
    );
  }

  // visible / enable — no static field property; rules fully control
  const rules = field.rules?.filter((r) => r.effect === effect);
  if (!rules || rules.length === 0) return BOOLEAN_EFFECT_DEFAULTS[effect];
  return rules.some((rule) =>
    evaluateRule(rule, normalized, responses, dangerouslyAllowJS)
  );
}

/**
 * Resolve a setValue effect — find the first matching rule and evaluate its expression
 * to compute the field value.
 *
 * Returns the computed value (string/number/null) or null if no rule matches.
 */
export function resolveSetValue(
  field: Pick<FieldDefinition, 'rules'>,
  normalized: NormalizedDefinition,
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean
): string | number | null {
  const rules = field.rules?.filter((r) => r.effect === 'setValue') ?? [];

  for (const rule of rules) {
    const isExpressionOnly =
      rule.conditions.length > 0 &&
      rule.conditions.every(
        (c) => c.conditionType === 'expression' && !c.targetId && !c.operator
      );

    const expressionCondition = rule.conditions.find(
      (c) => c.conditionType === 'expression' && c.expression
    );

    if (isExpressionOnly && expressionCondition?.expression) {
      try {
        const result = evaluateExpression(
          expressionCondition.expression,
          normalized,
          responses
        );
        if (result === null || result === undefined) return null;
        if (typeof result === 'string' || typeof result === 'number') {
          return result;
        }
        return String(result);
      } catch {
        continue;
      }
    }

    if (evaluateRule(rule, normalized, responses, dangerouslyAllowJS)) {
      if (expressionCondition?.expression) {
        try {
          const result = evaluateExpression(
            expressionCondition.expression,
            normalized,
            responses
          );
          if (result === null || result === undefined) return null;
          if (typeof result === 'string' || typeof result === 'number') {
            return result;
          }
          return String(result);
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

/**
 * Resolve a conditional effect for a single field.
 *
 * For boolean effects (visible, enable, required), returns true/false.
 * For value effects (setValue), use resolveSetValue() directly.
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
  },
  normalized: NormalizedDefinition,
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean
): boolean {
  // Delegate to appropriate handler
  if (effect === 'setValue') {
    // setValue is a value effect, not boolean — use resolveSetValue() instead
    return false;
  }

  return resolveBooleanEffect(
    effect,
    field,
    normalized,
    responses,
    dangerouslyAllowJS
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
  dangerouslyAllowJS?: boolean
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
        dangerouslyAllowJS
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
        dangerouslyAllowJS
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
