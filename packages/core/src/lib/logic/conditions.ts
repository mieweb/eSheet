// ---------------------------------------------------------------------------
// Conditional Logic — evaluate conditions and rules
// ---------------------------------------------------------------------------

import type {
  Condition,
  ConditionalRule,
  FieldDefinition,
  FieldResponse,
  FormResponse,
  SelectedOption,
} from '../types.js';
import { NUMERIC_EXPRESSION_FORMATS } from '../types.js';
import type { NormalizedDefinition } from '../functions/normalize.js';

// ---------------------------------------------------------------------------
// evaluateRule()
// ---------------------------------------------------------------------------

/**
 * Evaluate a conditional rule against the full form state.
 *
 * Looks up each condition's target in the normalized definition and
 * responses, then combines results with the rule's logic mode.
 *
 * Returns `true` when:
 * - The rule has no conditions (vacuous truth).
 * - AND mode and **all** conditions pass.
 * - OR mode and **at least one** condition passes.
 *
 * @param rule       - The conditional rule to evaluate.
 * @param normalized - The normalized form definition (flat `byId` map).
 * @param responses  - The current form responses.
 */
export function evaluateRule(
  rule: ConditionalRule,
  normalized: NormalizedDefinition,
  responses: FormResponse
): boolean {
  if (rule.conditions.length === 0) return true;

  const results = rule.conditions.map((cond) => {
    const node = normalized.byId[cond.targetId];
    if (!node) return false;
    return evaluateCondition(cond, node.definition, responses[cond.targetId]);
  });

  return rule.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

// ---------------------------------------------------------------------------
// evaluateCondition()
// ---------------------------------------------------------------------------

/**
 * Evaluate a single condition against a target field's definition and response.
 *
 * The caller is responsible for resolving the target field — this function
 * receives the pre-looked-up definition and response directly.
 *
 * @param condition  - The condition to evaluate.
 * @param definition - The target field's definition (without nested `fields`).
 * @param response   - The target field's current response, or `undefined`.
 */
export function evaluateCondition(
  condition: Condition,
  definition: Omit<FieldDefinition, 'fields'>,
  response: FieldResponse | undefined
): boolean {
  let actual: unknown = getActualValue(definition, response);
  const { operator, expected, propertyAccessor } = condition;

  // Apply property accessor (length / count)
  if (propertyAccessor) {
    actual = applyPropertyAccessor(actual, propertyAccessor);
  }

  // empty / notEmpty — no expected value needed
  if (operator === 'empty') return isEmpty(actual);
  if (operator === 'notEmpty') return !isEmpty(actual);

  // If operator is numeric and actual is a non-numeric option ID, resolve via options
  if (
    NUMERIC_OPERATORS.has(operator) &&
    typeof actual === 'string' &&
    isNaN(parseFloat(actual))
  ) {
    if (definition.options) {
      const opt = definition.options.find((o) => o.id === actual);
      if (opt) {
        const parsed = parseFloat(opt.value);
        if (!isNaN(parsed)) actual = parsed;
      }
    }
  }

  // Decide numeric vs string path
  const isNumericExpr =
    definition.fieldType === 'expression' &&
    definition.displayFormat != null &&
    (NUMERIC_EXPRESSION_FORMATS as readonly string[]).includes(
      definition.displayFormat
    );
  const isNumericText =
    definition.fieldType === 'text' && definition.inputType === 'number';
  const isNumeric =
    NUMERIC_OPERATORS.has(operator) ||
    typeof actual === 'number' ||
    isNumericExpr ||
    isNumericText;

  if (isNumeric) {
    const actualNum =
      typeof actual === 'number' ? actual : parseFloat(String(actual));
    const expectedNum = parseFloat(expected);
    if (isNaN(actualNum) || isNaN(expectedNum)) return false;
    return evaluateNumeric(actualNum, expectedNum, operator);
  }

  // String / array operators
  switch (operator) {
    case 'equals':
      if (Array.isArray(actual)) return false;
      return String(actual ?? '') === String(expected ?? '');

    case 'notEquals':
      if (Array.isArray(actual)) return true;
      return String(actual ?? '') !== String(expected ?? '');

    case 'contains': {
      const hay = normalizeForContains(String(actual ?? ''));
      const needle = normalizeForContains(expected ?? '');
      if (!needle) return false;
      const parts = needle.split(/\s+/);
      const pattern =
        parts.length === 1
          ? new RegExp(`(?:^|\\s)${escapeRegex(parts[0])}(?:\\s|$)`)
          : new RegExp(
              `(?:^|\\s)${parts.map(escapeRegex).join('\\s+')}(?:\\s|$)`
            );
      return pattern.test(hay);
    }

    case 'includes':
      if (!Array.isArray(actual)) return false;
      return (actual as string[]).map(String).includes(String(expected));

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function getActualValue(
  definition: Omit<FieldDefinition, 'fields'>,
  response: FieldResponse | undefined
): string | string[] | Record<string, unknown> | null {
  if (!response) return null;

  switch (definition.fieldType) {
    case 'text':
    case 'longtext':
    case 'expression':
      return response.answer ?? '';

    case 'multitext':
      return response.multitextAnswers
        ? Object.values(response.multitextAnswers)
        : [];

    case 'radio':
    case 'dropdown':
    case 'boolean':
    case 'slider':
    case 'rating': {
      const sel = response.selected;
      if (
        sel != null &&
        !Array.isArray(sel) &&
        typeof sel === 'object' &&
        'id' in sel
      ) {
        return (sel as SelectedOption).id;
      }
      return null;
    }

    case 'check':
    case 'multiselectdropdown':
    case 'ranking':
      return Array.isArray(response.selected)
        ? (response.selected as SelectedOption[]).map((o) => o.id)
        : [];

    case 'singlematrix':
    case 'multimatrix':
      if (
        response.selected != null &&
        !Array.isArray(response.selected) &&
        typeof response.selected === 'object'
      ) {
        return response.selected as Record<string, unknown>;
      }
      return {};

    default:
      return null;
  }
}

function applyPropertyAccessor(value: unknown, accessor: string): number {
  const prop = accessor.toLowerCase();
  if (prop !== 'length' && prop !== 'count') return 0;

  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.length;
  if (typeof value === 'object' && value !== null)
    return Object.keys(value).length;
  return 0;
}

const NUMERIC_OPERATORS = new Set<string>([
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return String(value).trim() === '';
}

function evaluateNumeric(
  actual: number,
  expected: number,
  operator: string
): boolean {
  switch (operator) {
    case 'equals':
      return Math.abs(actual - expected) < Number.EPSILON * 10;
    case 'notEquals':
      return Math.abs(actual - expected) >= Number.EPSILON * 10;
    case 'greaterThan':
      return actual > expected;
    case 'greaterThanOrEqual':
      return actual >= expected;
    case 'lessThan':
      return actual < expected;
    case 'lessThanOrEqual':
      return actual <= expected;
    default:
      return false;
  }
}

function normalizeForContains(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
