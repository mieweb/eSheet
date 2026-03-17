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
    const isExpressionCondition =
      cond.conditionType === 'expression' ||
      (!!cond.expression && cond.expression.trim().length > 0);

    if (isExpressionCondition) {
      return evaluateExpressionCondition(cond, normalized, responses);
    }

    if (!cond.targetId || !cond.operator) return false;
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
  if (!condition.operator) return false;

  let actual: unknown = getActualValue(definition, response);
  const { operator, propertyAccessor } = condition;
  const expected = condition.expected ?? '';

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

function evaluateExpressionCondition(
  condition: Condition,
  normalized: NormalizedDefinition,
  responses: FormResponse
): boolean {
  const expression = condition.expression?.trim();
  if (!expression) return false;

  const actual = evaluateExpressionToValue(expression, normalized, responses);
  const operator = condition.operator;
  const expected = condition.expected ?? '';

  // Expression-only mode (no operator/expected provided):
  // treat boolean results as-is, otherwise use truthiness.
  if (!operator) {
    if (typeof actual === 'boolean') return actual;
    return Boolean(actual) && !isEmpty(actual);
  }

  // When expression already resolves to boolean, allow direct truth checks.
  if (typeof actual === 'boolean') {
    if (operator === 'equals') {
      if (!expected.trim()) return actual;
      return actual === parseBoolean(expected);
    }
    if (operator === 'notEquals') {
      if (!expected.trim()) return !actual;
      return actual !== parseBoolean(expected);
    }
    // For other operators, fall back to truthiness to avoid hard-failing boolean expressions.
    return actual;
  }

  if (operator === 'empty') return isEmpty(actual);
  if (operator === 'notEmpty') return !isEmpty(actual);

  if (NUMERIC_OPERATORS.has(operator)) {
    const actualNum = typeof actual === 'number' ? actual : parseFloat(String(actual));
    const expectedNum = parseFloat(expected);
    if (isNaN(actualNum) || isNaN(expectedNum)) return false;
    return evaluateNumeric(actualNum, expectedNum, operator);
  }

  switch (operator) {
    case 'equals':
      return String(actual ?? '') === String(expected ?? '');
    case 'notEquals':
      return String(actual ?? '') !== String(expected ?? '');
    case 'contains': {
      const hay = normalizeForContains(String(actual ?? ''));
      const needle = normalizeForContains(expected ?? '');
      if (!needle) return false;
      const parts = needle.split(/\s+/);
      const pattern =
        parts.length === 1
          ? new RegExp(`(?:^|\\s)${escapeRegex(parts[0])}(?:\\s|$)`)
          : new RegExp(`(?:^|\\s)${parts.map(escapeRegex).join('\\s+')}(?:\\s|$)`);
      return pattern.test(hay);
    }
    case 'includes':
      return Array.isArray(actual)
        ? (actual as string[]).map(String).includes(String(expected ?? ''))
        : false;
    default:
      return false;
  }
}

function evaluateExpressionToValue(
  expression: string,
  normalized: NormalizedDefinition,
  responses: FormResponse
): unknown {
  const data = buildExpressionData(normalized, responses);
  return evaluateSafeExpression(expression, data);
}

type ExprTokenType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'null'
  | 'field'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'dot'
  | 'identifier';

interface ExprToken {
  type: ExprTokenType;
  value: string | number | boolean | null;
}

type ExprNode =
  | { type: 'literal'; value: unknown }
  | { type: 'field'; id: string }
  | { type: 'member'; object: ExprNode; property: 'length' | 'count' }
  | { type: 'unary'; operator: '!' | '-'; right: ExprNode }
  | {
      type: 'binary';
      operator:
        | '||'
        | '&&'
        | '=='
        | '!='
        | '==='
        | '!=='
        | '>'
        | '>='
        | '<'
        | '<='
        | '+'
        | '-'
        | '*'
        | '/'
        | '%';
      left: ExprNode;
      right: ExprNode;
    };

export function isExpressionValid(expression: string): boolean {
  const tokens = tokenizeExpression(expression);
  if (!tokens) return false;
  return parseExpression(tokens) !== null;
}

function evaluateSafeExpression(
  expression: string,
  data: Record<string, unknown>
): unknown {
  const tokens = tokenizeExpression(expression);
  if (!tokens) return null;

  const ast = parseExpression(tokens);
  if (!ast) return null;

  try {
    return evaluateExpressionAst(ast, data);
  } catch {
    return null;
  }
}

function tokenizeExpression(source: string): ExprToken[] | null {
  const tokens: ExprToken[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '{') {
      const end = source.indexOf('}', i + 1);
      if (end === -1) return null;
      const fieldId = source.slice(i + 1, end).trim();
      if (!fieldId) return null;
      tokens.push({ type: 'field', value: fieldId });
      i = end + 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let value = '';
      while (i < source.length) {
        const c = source[i];
        if (c === '\\') {
          const next = source[i + 1];
          if (next == null) return null;
          value += next;
          i += 2;
          continue;
        }
        if (c === quote) {
          i += 1;
          break;
        }
        value += c;
        i += 1;
      }
      if (i > source.length) return null;
      if (source[i - 1] !== quote) return null;
      tokens.push({ type: 'string', value });
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i += 1;
      continue;
    }
    if (ch === '.') {
      tokens.push({ type: 'dot', value: ch });
      i += 1;
      continue;
    }

    const three = source.slice(i, i + 3);
    if (three === '===') {
      tokens.push({ type: 'op', value: '===' });
      i += 3;
      continue;
    }
    if (three === '!==') {
      tokens.push({ type: 'op', value: '!==' });
      i += 3;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (
      two === '&&' ||
      two === '||' ||
      two === '==' ||
      two === '!=' ||
      two === '>=' ||
      two === '<='
    ) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    if ('><+-*/%!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    const numberMatch = source.slice(i).match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      const raw = numberMatch[0];
      tokens.push({ type: 'number', value: parseFloat(raw) });
      i += raw.length;
      continue;
    }

    const identifierMatch = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      const ident = identifierMatch[0];
      if (ident === 'true') {
        tokens.push({ type: 'boolean', value: true });
      } else if (ident === 'false') {
        tokens.push({ type: 'boolean', value: false });
      } else if (ident === 'null') {
        tokens.push({ type: 'null', value: null });
      } else {
        tokens.push({ type: 'identifier', value: ident });
      }
      i += ident.length;
      continue;
    }

    return null;
  }

  return tokens;
}

function parseExpression(tokens: ExprToken[]): ExprNode | null {
  let index = 0;

  const peek = (): ExprToken | undefined => tokens[index];
  const consume = (): ExprToken | undefined => {
    const t = tokens[index];
    index += 1;
    return t;
  };

  const matchOp = (op: string): boolean => {
    const t = peek();
    if (t?.type === 'op' && t.value === op) {
      consume();
      return true;
    }
    return false;
  };

  const parsePrimary = (): ExprNode | null => {
    const t = peek();
    if (!t) return null;

    if (
      t.type === 'number' ||
      t.type === 'string' ||
      t.type === 'boolean' ||
      t.type === 'null'
    ) {
      consume();
      return { type: 'literal', value: t.value };
    }

    if (t.type === 'field') {
      consume();
      return { type: 'field', id: String(t.value) };
    }

    if (t.type === 'lparen') {
      consume();
      const expr = parseOr();
      const close = consume();
      if (!expr || close?.type !== 'rparen') return null;
      return expr;
    }

    return null;
  };

  const parseMember = (): ExprNode | null => {
    let node = parsePrimary();
    if (!node) return null;

    while (peek()?.type === 'dot') {
      consume();
      const prop = consume();
      if (prop?.type !== 'identifier') return null;
      const propName = String(prop.value);
      if (propName !== 'length' && propName !== 'count') return null;
      node = { type: 'member', object: node, property: propName };
    }

    return node;
  };

  const parseUnary = (): ExprNode | null => {
    const t = peek();
    if (t?.type === 'op' && (t.value === '!' || t.value === '-')) {
      consume();
      const right = parseUnary();
      if (!right) return null;
      return { type: 'unary', operator: t.value as '!' | '-', right };
    }
    return parseMember();
  };

  const parseMultiplicative = (): ExprNode | null => {
    let node = parseUnary();
    if (!node) return null;
    while (true) {
      const t = peek();
      if (!t || t.type !== 'op' || !['*', '/', '%'].includes(String(t.value))) break;
      consume();
      const right = parseUnary();
      if (!right) return null;
      node = {
        type: 'binary',
        operator: t.value as '*' | '/' | '%',
        left: node,
        right,
      };
    }
    return node;
  };

  const parseAdditive = (): ExprNode | null => {
    let node = parseMultiplicative();
    if (!node) return null;
    while (true) {
      const t = peek();
      if (!t || t.type !== 'op' || !['+', '-'].includes(String(t.value))) break;
      consume();
      const right = parseMultiplicative();
      if (!right) return null;
      node = {
        type: 'binary',
        operator: t.value as '+' | '-',
        left: node,
        right,
      };
    }
    return node;
  };

  const parseRelational = (): ExprNode | null => {
    let node = parseAdditive();
    if (!node) return null;
    while (true) {
      const t = peek();
      if (!t || t.type !== 'op' || !['>', '>=', '<', '<='].includes(String(t.value))) break;
      consume();
      const right = parseAdditive();
      if (!right) return null;
      node = {
        type: 'binary',
        operator: t.value as '>' | '>=' | '<' | '<=',
        left: node,
        right,
      };
    }
    return node;
  };

  const parseEquality = (): ExprNode | null => {
    let node = parseRelational();
    if (!node) return null;
    while (true) {
      const t = peek();
      if (
        !t ||
        t.type !== 'op' ||
        !['==', '!=', '===', '!=='].includes(String(t.value))
      ) {
        break;
      }
      consume();
      const right = parseRelational();
      if (!right) return null;
      node = {
        type: 'binary',
        operator: t.value as '==' | '!=' | '===' | '!==',
        left: node,
        right,
      };
    }
    return node;
  };

  const parseAnd = (): ExprNode | null => {
    let node = parseEquality();
    if (!node) return null;
    while (matchOp('&&')) {
      const right = parseEquality();
      if (!right) return null;
      node = { type: 'binary', operator: '&&', left: node, right };
    }
    return node;
  };

  const parseOr = (): ExprNode | null => {
    let node = parseAnd();
    if (!node) return null;
    while (matchOp('||')) {
      const right = parseAnd();
      if (!right) return null;
      node = { type: 'binary', operator: '||', left: node, right };
    }
    return node;
  };

  const root = parseOr();
  if (!root || index !== tokens.length) return null;
  return root;
}

function evaluateExpressionAst(
  node: ExprNode,
  data: Record<string, unknown>
): unknown {
  if (node.type === 'literal') return node.value;

  if (node.type === 'field') {
    const value = data[node.id];
    return value ?? '';
  }

  if (node.type === 'member') {
    const value = evaluateExpressionAst(node.object, data);
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'string') return value.length;
    if (value != null && typeof value === 'object') return Object.keys(value).length;
    return 0;
  }

  if (node.type === 'unary') {
    const right = evaluateExpressionAst(node.right, data);
    if (node.operator === '!') return !Boolean(right);
    if (node.operator === '-') return -toNumber(right);
    return null;
  }

  if (node.operator === '&&') {
    const left = evaluateExpressionAst(node.left, data);
    if (!Boolean(left)) return left;
    return evaluateExpressionAst(node.right, data);
  }

  if (node.operator === '||') {
    const left = evaluateExpressionAst(node.left, data);
    if (Boolean(left)) return left;
    return evaluateExpressionAst(node.right, data);
  }

  const left = evaluateExpressionAst(node.left, data);
  const right = evaluateExpressionAst(node.right, data);

  switch (node.operator) {
    case '==':
      // Intentional JS-like loose equality support for existing schemas.
      // eslint-disable-next-line eqeqeq
      return left == right;
    case '!=':
      // eslint-disable-next-line eqeqeq
      return left != right;
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '>':
      return toNumber(left) > toNumber(right);
    case '>=':
      return toNumber(left) >= toNumber(right);
    case '<':
      return toNumber(left) < toNumber(right);
    case '<=':
      return toNumber(left) <= toNumber(right);
    case '+':
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left ?? '') + String(right ?? '');
      }
      return toNumber(left) + toNumber(right);
    case '-':
      return toNumber(left) - toNumber(right);
    case '*':
      return toNumber(left) * toNumber(right);
    case '/':
      return toNumber(left) / toNumber(right);
    case '%':
      return toNumber(left) % toNumber(right);
    default:
      return null;
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const parsed = parseFloat(String(value ?? ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return Boolean(normalized);
}

function buildExpressionData(
  normalized: NormalizedDefinition,
  responses: FormResponse
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [fieldId, node] of Object.entries(normalized.byId)) {
    data[fieldId] = getExpressionFieldValue(node.definition, responses[fieldId]);
  }
  return data;
}

function getExpressionFieldValue(
  definition: Omit<FieldDefinition, 'fields'>,
  response: FieldResponse | undefined
): unknown {
  if (!response) return '';

  if (
    definition.fieldType === 'text' ||
    definition.fieldType === 'longtext' ||
    definition.fieldType === 'expression'
  ) {
    const raw = response.answer ?? '';
    const parsed = parseFloat(String(raw));
    return Number.isNaN(parsed) ? raw : parsed;
  }

  if (
    definition.fieldType === 'radio' ||
    definition.fieldType === 'dropdown' ||
    definition.fieldType === 'boolean' ||
    definition.fieldType === 'slider' ||
    definition.fieldType === 'rating'
  ) {
    const selected = response.selected;
    if (
      selected != null &&
      !Array.isArray(selected) &&
      typeof selected === 'object' &&
      'id' in selected
    ) {
      const selectedId = (selected as SelectedOption).id;
      const opt = definition.options?.find((o) => o.id === selectedId);
      const raw = opt?.value ?? selectedId;
      const parsed = parseFloat(raw);
      return Number.isNaN(parsed) ? raw : parsed;
    }
    return definition.fieldType === 'rating' ? 0 : '';
  }

  if (
    definition.fieldType === 'check' ||
    definition.fieldType === 'multiselectdropdown' ||
    definition.fieldType === 'ranking'
  ) {
    if (!Array.isArray(response.selected)) return [];
    return (response.selected as SelectedOption[]).map((s) => {
      const mapped = definition.options?.find((o) => o.id === s.id);
      return mapped?.value ?? s.id;
    });
  }

  return getActualValue(definition, response);
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
