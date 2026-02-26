import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateRule } from './conditions.js';
import type { Condition, ConditionalRule, FieldDefinition, FieldResponse } from '../types.js';
import type { FieldNode, NormalizedDefinition } from '../functions/normalize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Def = Omit<FieldDefinition, 'fields'>;

function textDef(id: string, inputType?: string): Def {
  return { id, fieldType: 'text', question: 'Q', ...(inputType ? { inputType: inputType as FieldDefinition['inputType'] } : {}) };
}

function radioDef(id: string, options?: FieldDefinition['options']): Def {
  return { id, fieldType: 'radio', question: 'Q', options };
}

function checkDef(id: string, options?: FieldDefinition['options']): Def {
  return { id, fieldType: 'check', question: 'Q', options };
}

function ratingDef(id: string, options?: FieldDefinition['options']): Def {
  return { id, fieldType: 'rating', question: 'Q', options };
}

function exprDef(id: string, displayFormat: FieldDefinition['displayFormat']): Def {
  return { id, fieldType: 'expression', question: 'Q', displayFormat };
}

function cond(
  targetId: string,
  operator: Condition['operator'],
  expected = '',
  propertyAccessor?: string,
): Condition {
  return { targetId, operator, expected, ...(propertyAccessor ? { propertyAccessor } : {}) };
}

function node(def: Def, index = 0): FieldNode {
  return { definition: def, parentId: null, childIds: [], index };
}

function norm(nodes: Record<string, FieldNode>): NormalizedDefinition {
  return { byId: nodes, rootIds: Object.keys(nodes) };
}

// ---------------------------------------------------------------------------
// evaluateCondition — string operators
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  describe('equals / notEquals (string)', () => {
    it('equals — matching strings', () => {
      expect(evaluateCondition(cond('f', 'equals', 'hello'), textDef('f'), { answer: 'hello' })).toBe(true);
    });

    it('equals — non-matching strings', () => {
      expect(evaluateCondition(cond('f', 'equals', 'hello'), textDef('f'), { answer: 'world' })).toBe(false);
    });

    it('notEquals — different strings', () => {
      expect(evaluateCondition(cond('f', 'notEquals', 'hello'), textDef('f'), { answer: 'world' })).toBe(true);
    });

    it('notEquals — same strings returns false', () => {
      expect(evaluateCondition(cond('f', 'notEquals', 'hello'), textDef('f'), { answer: 'hello' })).toBe(false);
    });

    it('equals — single-select compares option ID', () => {
      const def = radioDef('f', [{ id: 'opt_1', value: 'Yes' }]);
      const resp: FieldResponse = { selected: { id: 'opt_1', value: 'Yes' } };
      expect(evaluateCondition(cond('f', 'equals', 'opt_1'), def, resp)).toBe(true);
    });

    it('equals — array actual returns false', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }] };
      expect(evaluateCondition(cond('f', 'equals', 'opt_1'), def, resp)).toBe(false);
    });

    it('notEquals — array actual returns true', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }] };
      expect(evaluateCondition(cond('f', 'notEquals', 'opt_1'), def, resp)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Numeric operators
  // ---------------------------------------------------------------------------

  describe('numeric operators', () => {
    it('equals — float-safe (0.1 + 0.2 ≈ 0.3)', () => {
      const val = String(0.1 + 0.2); // "0.30000000000000004"
      expect(evaluateCondition(cond('f', 'equals', '0.3'), textDef('f', 'number'), { answer: val })).toBe(true);
    });

    it('notEquals — different numbers', () => {
      expect(evaluateCondition(cond('f', 'notEquals', '5'), textDef('f', 'number'), { answer: '10' })).toBe(true);
    });

    it('greaterThan', () => {
      expect(evaluateCondition(cond('f', 'greaterThan', '5'), textDef('f'), { answer: '10' })).toBe(true);
      expect(evaluateCondition(cond('f', 'greaterThan', '5'), textDef('f'), { answer: '3' })).toBe(false);
    });

    it('greaterThanOrEqual — equal value', () => {
      expect(evaluateCondition(cond('f', 'greaterThanOrEqual', '5'), textDef('f'), { answer: '5' })).toBe(true);
    });

    it('lessThan', () => {
      expect(evaluateCondition(cond('f', 'lessThan', '10'), textDef('f'), { answer: '5' })).toBe(true);
      expect(evaluateCondition(cond('f', 'lessThan', '10'), textDef('f'), { answer: '15' })).toBe(false);
    });

    it('lessThanOrEqual — equal value', () => {
      expect(evaluateCondition(cond('f', 'lessThanOrEqual', '5'), textDef('f'), { answer: '5' })).toBe(true);
    });

    it('NaN values return false', () => {
      expect(evaluateCondition(cond('f', 'greaterThan', '5'), textDef('f'), { answer: 'abc' })).toBe(false);
      expect(evaluateCondition(cond('f', 'greaterThan', 'abc'), textDef('f'), { answer: '5' })).toBe(false);
    });

    it('numeric expression field uses float comparison for equals', () => {
      const def = exprDef('f', 'number');
      expect(evaluateCondition(cond('f', 'equals', '0.3'), def, { answer: String(0.1 + 0.2) })).toBe(true);
    });

    it('selection field resolves option value for numeric operators', () => {
      const def = ratingDef('f', [
        { id: 'star_1', value: '1' },
        { id: 'star_2', value: '2' },
        { id: 'star_3', value: '3' },
      ]);
      const resp: FieldResponse = { selected: { id: 'star_2', value: '2' } };
      expect(evaluateCondition(cond('f', 'greaterThanOrEqual', '2'), def, resp)).toBe(true);
      expect(evaluateCondition(cond('f', 'greaterThan', '2'), def, resp)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // contains
  // ---------------------------------------------------------------------------

  describe('contains', () => {
    it('matches whole word', () => {
      expect(evaluateCondition(cond('f', 'contains', 'hello'), textDef('f'), { answer: 'hello world' })).toBe(true);
    });

    it('no match for partial word', () => {
      expect(evaluateCondition(cond('f', 'contains', 'hell'), textDef('f'), { answer: 'hello world' })).toBe(false);
    });

    it('case insensitive', () => {
      expect(evaluateCondition(cond('f', 'contains', 'HELLO'), textDef('f'), { answer: 'Hello World' })).toBe(true);
    });

    it('diacritics normalized', () => {
      expect(evaluateCondition(cond('f', 'contains', 'cafe'), textDef('f'), { answer: 'Café Latte' })).toBe(true);
    });

    it('multi-word needle matches in order', () => {
      expect(evaluateCondition(cond('f', 'contains', 'hello world'), textDef('f'), { answer: 'say hello world now' })).toBe(true);
    });

    it('empty needle returns false', () => {
      expect(evaluateCondition(cond('f', 'contains', ''), textDef('f'), { answer: 'hello' })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // includes
  // ---------------------------------------------------------------------------

  describe('includes', () => {
    it('found in array', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }, { id: 'opt_2', value: 'B' }] };
      expect(evaluateCondition(cond('f', 'includes', 'opt_2'), def, resp)).toBe(true);
    });

    it('not found in array', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }] };
      expect(evaluateCondition(cond('f', 'includes', 'opt_99'), def, resp)).toBe(false);
    });

    it('non-array returns false', () => {
      expect(evaluateCondition(cond('f', 'includes', 'x'), textDef('f'), { answer: 'x' })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // empty / notEmpty
  // ---------------------------------------------------------------------------

  describe('empty / notEmpty', () => {
    it('null response → empty', () => {
      expect(evaluateCondition(cond('f', 'empty'), textDef('f'), undefined)).toBe(true);
    });

    it('empty string → empty', () => {
      expect(evaluateCondition(cond('f', 'empty'), textDef('f'), { answer: '' })).toBe(true);
    });

    it('whitespace-only → empty', () => {
      expect(evaluateCondition(cond('f', 'empty'), textDef('f'), { answer: '   ' })).toBe(true);
    });

    it('empty array → empty', () => {
      const def = checkDef('f');
      expect(evaluateCondition(cond('f', 'empty'), def, { selected: [] })).toBe(true);
    });

    it('notEmpty with value → true', () => {
      expect(evaluateCondition(cond('f', 'notEmpty'), textDef('f'), { answer: 'hi' })).toBe(true);
    });

    it('notEmpty with null response → false', () => {
      expect(evaluateCondition(cond('f', 'notEmpty'), textDef('f'), undefined)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // propertyAccessor
  // ---------------------------------------------------------------------------

  describe('propertyAccessor', () => {
    it('length on string', () => {
      expect(evaluateCondition(cond('f', 'greaterThan', '3', 'length'), textDef('f'), { answer: 'hello' })).toBe(true);
    });

    it('length on array', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }] };
      expect(evaluateCondition(cond('f', 'equals', '2', 'length'), def, resp)).toBe(true);
    });

    it('count alias same as length', () => {
      expect(evaluateCondition(cond('f', 'equals', '5', 'count'), textDef('f'), { answer: 'hello' })).toBe(true);
    });

    it('unknown accessor returns 0', () => {
      expect(evaluateCondition(cond('f', 'equals', '0', 'unknown'), textDef('f'), { answer: 'hello' })).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('undefined response treated as null → null actual', () => {
      expect(evaluateCondition(cond('f', 'equals', 'x'), textDef('f'), undefined)).toBe(false);
    });

    it('no selected on radio → null actual', () => {
      expect(evaluateCondition(cond('f', 'equals', 'opt_1'), radioDef('f'), {})).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateRule
// ---------------------------------------------------------------------------

describe('evaluateRule', () => {
  const textNode = node(textDef('f1'));
  const radioNode = node(radioDef('f2', [{ id: 'opt_1', value: 'Yes' }, { id: 'opt_2', value: 'No' }]), 1);
  const normalized = norm({ f1: textNode, f2: radioNode });

  it('AND — all conditions true', () => {
    const rule: ConditionalRule = {
      effect: 'visible',
      logic: 'AND',
      conditions: [
        cond('f1', 'equals', 'hello'),
        cond('f2', 'equals', 'opt_1'),
      ],
    };
    const responses = {
      f1: { answer: 'hello' },
      f2: { selected: { id: 'opt_1', value: 'Yes' } } as FieldResponse,
    };
    expect(evaluateRule(rule, normalized, responses)).toBe(true);
  });

  it('AND — one condition false', () => {
    const rule: ConditionalRule = {
      effect: 'visible',
      logic: 'AND',
      conditions: [
        cond('f1', 'equals', 'hello'),
        cond('f2', 'equals', 'opt_1'),
      ],
    };
    const responses = {
      f1: { answer: 'hello' },
      f2: { selected: { id: 'opt_2', value: 'No' } } as FieldResponse,
    };
    expect(evaluateRule(rule, normalized, responses)).toBe(false);
  });

  it('OR — one condition true', () => {
    const rule: ConditionalRule = {
      effect: 'visible',
      logic: 'OR',
      conditions: [
        cond('f1', 'equals', 'nope'),
        cond('f2', 'equals', 'opt_1'),
      ],
    };
    const responses = {
      f1: { answer: 'hello' },
      f2: { selected: { id: 'opt_1', value: 'Yes' } } as FieldResponse,
    };
    expect(evaluateRule(rule, normalized, responses)).toBe(true);
  });

  it('OR — all conditions false', () => {
    const rule: ConditionalRule = {
      effect: 'visible',
      logic: 'OR',
      conditions: [
        cond('f1', 'equals', 'nope'),
        cond('f2', 'equals', 'opt_99'),
      ],
    };
    const responses = {
      f1: { answer: 'hello' },
      f2: { selected: { id: 'opt_1', value: 'Yes' } } as FieldResponse,
    };
    expect(evaluateRule(rule, normalized, responses)).toBe(false);
  });

  it('empty conditions → true (vacuous truth)', () => {
    const rule: ConditionalRule = { effect: 'visible', logic: 'AND', conditions: [] };
    expect(evaluateRule(rule, normalized, {})).toBe(true);
  });

  it('unknown targetId → false for that condition', () => {
    const rule: ConditionalRule = {
      effect: 'visible',
      logic: 'AND',
      conditions: [cond('nonexistent', 'equals', 'x')],
    };
    expect(evaluateRule(rule, normalized, {})).toBe(false);
  });
});
