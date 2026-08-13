import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateOptionVisibility,
  evaluateRule,
  evaluateExpression,
} from './conditions.js';
import type {
  Condition,
  ConditionalRule,
  FieldDefinition,
  TextFieldDefinition,
  FieldOption,
  FieldResponse,
} from '../types.js';
import type {
  FieldNode,
  NormalizedDefinition,
} from '../functions/normalize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Def = FieldDefinition;

function textDef(id: string, inputType?: string): Def {
  return {
    id,
    fieldType: 'text',
    question: 'Q',
    ...(inputType
      ? { inputType: inputType as TextFieldDefinition['inputType'] }
      : {}),
  };
}

function radioDef(id: string, options?: FieldOption[]): Def {
  return { id, fieldType: 'radio', question: 'Q', options };
}

function checkDef(id: string, options?: FieldOption[]): Def {
  return { id, fieldType: 'check', question: 'Q', options };
}

function ratingDef(id: string, options?: FieldOption[]): Def {
  return { id, fieldType: 'rating', question: 'Q', options };
}

function numericTextDef(id: string): Def {
  return { id, fieldType: 'text', inputType: 'number', question: 'Q' };
}

function cond(
  targetId: string,
  operator: Condition['operator'],
  expected = '',
  propertyAccessor?: string
): Condition {
  return {
    targetId,
    operator,
    expected,
    ...(propertyAccessor ? { propertyAccessor } : {}),
  };
}

function node(def: Def, index = 0): FieldNode {
  return { definition: def, parentId: null, childIds: [], index };
}

function norm(nodes: Record<string, FieldNode>): NormalizedDefinition {
  return { byId: nodes, pages: [] };
}

// ---------------------------------------------------------------------------
// evaluateCondition — string operators
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  describe('equals / notEquals (string)', () => {
    it('equals — matching strings', () => {
      expect(
        evaluateCondition(cond('f', 'equals', 'hello'), textDef('f'), {
          answer: 'hello',
        })
      ).toBe(true);
    });

    it('equals — non-matching strings', () => {
      expect(
        evaluateCondition(cond('f', 'equals', 'hello'), textDef('f'), {
          answer: 'world',
        })
      ).toBe(false);
    });

    it('notEquals — different strings', () => {
      expect(
        evaluateCondition(cond('f', 'notEquals', 'hello'), textDef('f'), {
          answer: 'world',
        })
      ).toBe(true);
    });

    it('notEquals — same strings returns false', () => {
      expect(
        evaluateCondition(cond('f', 'notEquals', 'hello'), textDef('f'), {
          answer: 'hello',
        })
      ).toBe(false);
    });

    it('equals — single-select compares option ID', () => {
      const def = radioDef('f', [{ id: 'opt_1', value: 'Yes' }]);
      const resp: FieldResponse = { selected: { id: 'opt_1', value: 'Yes' } };
      expect(evaluateCondition(cond('f', 'equals', 'opt_1'), def, resp)).toBe(
        true
      );
    });

    it('equals — array actual returns false', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }] };
      expect(evaluateCondition(cond('f', 'equals', 'opt_1'), def, resp)).toBe(
        false
      );
    });

    it('notEquals — array actual returns true', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }] };
      expect(
        evaluateCondition(cond('f', 'notEquals', 'opt_1'), def, resp)
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Numeric operators
  // ---------------------------------------------------------------------------

  describe('numeric operators', () => {
    it('equals — float-safe (0.1 + 0.2 ≈ 0.3)', () => {
      const val = String(0.1 + 0.2); // "0.30000000000000004"
      expect(
        evaluateCondition(cond('f', 'equals', '0.3'), textDef('f', 'number'), {
          answer: val,
        })
      ).toBe(true);
    });

    it('notEquals — different numbers', () => {
      expect(
        evaluateCondition(cond('f', 'notEquals', '5'), textDef('f', 'number'), {
          answer: '10',
        })
      ).toBe(true);
    });

    it('greaterThan', () => {
      expect(
        evaluateCondition(cond('f', 'greaterThan', '5'), textDef('f'), {
          answer: '10',
        })
      ).toBe(true);
      expect(
        evaluateCondition(cond('f', 'greaterThan', '5'), textDef('f'), {
          answer: '3',
        })
      ).toBe(false);
    });

    it('greaterThanOrEqual — equal value', () => {
      expect(
        evaluateCondition(cond('f', 'greaterThanOrEqual', '5'), textDef('f'), {
          answer: '5',
        })
      ).toBe(true);
    });

    it('lessThan', () => {
      expect(
        evaluateCondition(cond('f', 'lessThan', '10'), textDef('f'), {
          answer: '5',
        })
      ).toBe(true);
      expect(
        evaluateCondition(cond('f', 'lessThan', '10'), textDef('f'), {
          answer: '15',
        })
      ).toBe(false);
    });

    it('lessThanOrEqual — equal value', () => {
      expect(
        evaluateCondition(cond('f', 'lessThanOrEqual', '5'), textDef('f'), {
          answer: '5',
        })
      ).toBe(true);
    });

    it('NaN values return false', () => {
      expect(
        evaluateCondition(cond('f', 'greaterThan', '5'), textDef('f'), {
          answer: 'abc',
        })
      ).toBe(false);
      expect(
        evaluateCondition(cond('f', 'greaterThan', 'abc'), textDef('f'), {
          answer: '5',
        })
      ).toBe(false);
    });

    it('numeric text field uses float comparison for equals', () => {
      const def = numericTextDef('f');
      expect(
        evaluateCondition(cond('f', 'equals', '0.3'), def, {
          answer: String(0.1 + 0.2),
        })
      ).toBe(true);
    });

    it('selection field resolves option value for numeric operators', () => {
      const def = ratingDef('f', [
        { id: 'star_1', value: '1' },
        { id: 'star_2', value: '2' },
        { id: 'star_3', value: '3' },
      ]);
      const resp: FieldResponse = { selected: { id: 'star_2', value: '2' } };
      expect(
        evaluateCondition(cond('f', 'greaterThanOrEqual', '2'), def, resp)
      ).toBe(true);
      expect(evaluateCondition(cond('f', 'greaterThan', '2'), def, resp)).toBe(
        false
      );
    });
  });

  // ---------------------------------------------------------------------------
  // contains
  // ---------------------------------------------------------------------------

  describe('contains', () => {
    it('matches whole word', () => {
      expect(
        evaluateCondition(cond('f', 'contains', 'hello'), textDef('f'), {
          answer: 'hello world',
        })
      ).toBe(true);
    });

    it('no match for partial word', () => {
      expect(
        evaluateCondition(cond('f', 'contains', 'hell'), textDef('f'), {
          answer: 'hello world',
        })
      ).toBe(false);
    });

    it('case insensitive', () => {
      expect(
        evaluateCondition(cond('f', 'contains', 'HELLO'), textDef('f'), {
          answer: 'Hello World',
        })
      ).toBe(true);
    });

    it('diacritics normalized', () => {
      expect(
        evaluateCondition(cond('f', 'contains', 'cafe'), textDef('f'), {
          answer: 'Café Latte',
        })
      ).toBe(true);
    });

    it('multi-word needle matches in order', () => {
      expect(
        evaluateCondition(cond('f', 'contains', 'hello world'), textDef('f'), {
          answer: 'say hello world now',
        })
      ).toBe(true);
    });

    it('empty needle returns false', () => {
      expect(
        evaluateCondition(cond('f', 'contains', ''), textDef('f'), {
          answer: 'hello',
        })
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // includes
  // ---------------------------------------------------------------------------

  describe('includes', () => {
    it('found in array', () => {
      const def = checkDef('f');
      const resp: FieldResponse = {
        selected: [
          { id: 'opt_1', value: 'A' },
          { id: 'opt_2', value: 'B' },
        ],
      };
      expect(evaluateCondition(cond('f', 'includes', 'opt_2'), def, resp)).toBe(
        true
      );
    });

    it('not found in array', () => {
      const def = checkDef('f');
      const resp: FieldResponse = { selected: [{ id: 'opt_1', value: 'A' }] };
      expect(
        evaluateCondition(cond('f', 'includes', 'opt_99'), def, resp)
      ).toBe(false);
    });

    it('non-array returns false', () => {
      expect(
        evaluateCondition(cond('f', 'includes', 'x'), textDef('f'), {
          answer: 'x',
        })
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // empty / notEmpty
  // ---------------------------------------------------------------------------

  describe('empty / notEmpty', () => {
    it('null response → empty', () => {
      expect(
        evaluateCondition(cond('f', 'empty'), textDef('f'), undefined)
      ).toBe(true);
    });

    it('empty string → empty', () => {
      expect(
        evaluateCondition(cond('f', 'empty'), textDef('f'), { answer: '' })
      ).toBe(true);
    });

    it('whitespace-only → empty', () => {
      expect(
        evaluateCondition(cond('f', 'empty'), textDef('f'), { answer: '   ' })
      ).toBe(true);
    });

    it('empty array → empty', () => {
      const def = checkDef('f');
      expect(evaluateCondition(cond('f', 'empty'), def, { selected: [] })).toBe(
        true
      );
    });

    it('notEmpty with value → true', () => {
      expect(
        evaluateCondition(cond('f', 'notEmpty'), textDef('f'), { answer: 'hi' })
      ).toBe(true);
    });

    it('notEmpty with null response → false', () => {
      expect(
        evaluateCondition(cond('f', 'notEmpty'), textDef('f'), undefined)
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // propertyAccessor
  // ---------------------------------------------------------------------------

  describe('propertyAccessor', () => {
    it('length on string', () => {
      expect(
        evaluateCondition(
          cond('f', 'greaterThan', '3', 'length'),
          textDef('f'),
          { answer: 'hello' }
        )
      ).toBe(true);
    });

    it('length on array', () => {
      const def = checkDef('f');
      const resp: FieldResponse = {
        selected: [
          { id: 'a', value: 'A' },
          { id: 'b', value: 'B' },
        ],
      };
      expect(
        evaluateCondition(cond('f', 'equals', '2', 'length'), def, resp)
      ).toBe(true);
    });

    it('count alias same as length', () => {
      expect(
        evaluateCondition(cond('f', 'equals', '5', 'count'), textDef('f'), {
          answer: 'hello',
        })
      ).toBe(true);
    });

    it('unknown accessor returns 0', () => {
      expect(
        evaluateCondition(cond('f', 'equals', '0', 'unknown'), textDef('f'), {
          answer: 'hello',
        })
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('undefined response treated as null → null actual', () => {
      expect(
        evaluateCondition(cond('f', 'equals', 'x'), textDef('f'), undefined)
      ).toBe(false);
    });

    it('no selected on radio → null actual', () => {
      expect(
        evaluateCondition(cond('f', 'equals', 'opt_1'), radioDef('f'), {})
      ).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateRule
// ---------------------------------------------------------------------------

describe('evaluateRule', () => {
  const textNode = node(textDef('f1'));
  const radioNode = node(
    radioDef('f2', [
      { id: 'opt_1', value: 'Yes' },
      { id: 'opt_2', value: 'No' },
    ]),
    1
  );
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
      conditions: [cond('f1', 'equals', 'nope'), cond('f2', 'equals', 'opt_1')],
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
    const rule: ConditionalRule = {
      effect: 'visible',
      logic: 'AND',
      conditions: [],
    };
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

  describe('expression conditions', () => {
    const exprNormalized = norm({
      'expense-amount': node(textDef('expense-amount', 'number')),
      department: node(
        {
          id: 'department',
          fieldType: 'dropdown',
          question: 'Department',
          options: [
            { id: 'dep-finance', value: 'finance' },
            { id: 'dep-it', value: 'it' },
          ],
        },
        1
      ),
      'full-name': node(textDef('full-name'), 2),
    });

    it('evaluates expression conditions with hyphenated field IDs', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: "{expense-amount} > 1000 && {department} === 'finance'",
            operator: 'equals',
            expected: 'true',
          },
        ],
      };

      const responses = {
        'expense-amount': { answer: '1200' },
        department: { selected: { id: 'dep-finance', value: 'Finance' } },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, exprNormalized, responses)).toBe(true);
    });

    it('evaluates false when expression result does not match expected', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: "{expense-amount} > 1000 && {department} === 'finance'",
            operator: 'equals',
            expected: 'true',
          },
        ],
      };

      const responses = {
        'expense-amount': { answer: '500' },
        department: { selected: { id: 'dep-finance', value: 'Finance' } },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, exprNormalized, responses)).toBe(false);
    });

    it('supports boolean expression checks without explicit expected value', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: '{full-name}.length > 0',
            operator: 'equals',
            expected: '',
          },
        ],
      };

      const responses = {
        'full-name': { answer: 'Jane' },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, exprNormalized, responses)).toBe(true);
    });

    it('supports expression conditions without operator when result is boolean true', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: '{full-name}.length > 0',
          },
        ],
      };

      const responses = {
        'full-name': { answer: 'Jane' },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, exprNormalized, responses)).toBe(true);
    });

    it('supports expression conditions without operator when result is boolean false', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: '{full-name}.length > 0',
          },
        ],
      };

      const responses = {
        'full-name': { answer: '' },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, exprNormalized, responses)).toBe(false);
    });

    it('returns false for malformed expressions', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: '{expense-amount} >',
            operator: 'equals',
            expected: 'true',
          },
        ],
      };

      const responses = {
        'expense-amount': { answer: '1200' },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, exprNormalized, responses)).toBe(false);
    });

    it('supports arithmetic and member access without eval', () => {
      const normalizedWithMulti = norm({
        ...exprNormalized.byId,
        interests: node(
          {
            id: 'interests',
            fieldType: 'check',
            question: 'Interests',
            options: [
              { id: 'a', value: 'A' },
              { id: 'b', value: 'B' },
              { id: 'c', value: 'C' },
            ],
          },
          3
        ),
      });

      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression:
              '({expense-amount} * 2) > 1000 && {interests}.length >= 2',
            operator: 'equals',
            expected: 'true',
          },
        ],
      };

      const responses = {
        'expense-amount': { answer: '600' },
        interests: {
          selected: [
            { id: 'a', value: 'A' },
            { id: 'b', value: 'B' },
          ],
        },
      } as Record<string, FieldResponse>;

      expect(evaluateRule(rule, normalizedWithMulti, responses)).toBe(true);
    });

    it('rejects unsupported function-call syntax', () => {
      const rule: ConditionalRule = {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'expression',
            expression: 'Math.max(1, 2) > 1',
            operator: 'equals',
            expected: 'true',
          },
        ],
      };

      expect(evaluateRule(rule, exprNormalized, {})).toBe(false);
    });
  });
});

describe('evaluateOptionVisibility', () => {
  const normalized = norm({
    country: node(
      radioDef('country', [
        { id: 'us', value: 'United States' },
        { id: 'ca', value: 'Canada' },
      ])
    ),
  });

  it('evaluates option rules against the controlling field response', () => {
    const option: FieldOption = {
      id: 'houston-hq',
      value: 'Houston HQ',
      rules: [
        {
          effect: 'visible',
          logic: 'AND',
          conditions: [cond('country', 'equals', 'us')],
        },
      ],
    };

    expect(
      evaluateOptionVisibility(option, normalized, {
        country: {
          selected: { id: 'us', value: 'United States' },
        },
      })
    ).toBe(true);
    expect(
      evaluateOptionVisibility(option, normalized, {
        country: {
          selected: { id: 'ca', value: 'Canada' },
        },
      })
    ).toBe(false);
  });

  it('keeps options without visible rules visible', () => {
    expect(
      evaluateOptionVisibility(
        { id: 'always-visible', value: 'Always visible' },
        normalized,
        {}
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateExpression — built-in functions & date arithmetic
// ---------------------------------------------------------------------------

describe('evaluateExpression — built-in functions', () => {
  const fnNormalized = norm({
    start: node(textDef('start', 'date')),
    days: node(numericTextDef('days'), 1),
    other: node(textDef('other', 'date'), 2),
    flag: node(numericTextDef('flag'), 3),
  });

  const responses = {
    start: { answer: '2026-01-01' },
    days: { answer: '10' },
    other: { answer: '2026-01-21' },
    flag: { answer: '1' },
  } as Record<string, FieldResponse>;

  it('addDays adds days and returns an ISO date string', () => {
    expect(
      evaluateExpression('addDays({start}, {days})', fnNormalized, responses)
    ).toBe('2026-01-11');
  });

  it('addDays supports negative offsets', () => {
    expect(
      evaluateExpression('addDays({start}, -1)', fnNormalized, responses)
    ).toBe('2025-12-31');
  });

  it('subDays subtracts days', () => {
    expect(
      evaluateExpression('subDays({start}, 2)', fnNormalized, responses)
    ).toBe('2025-12-30');
  });

  it('diffDays returns whole days between two dates (a - b)', () => {
    expect(
      evaluateExpression('diffDays({other}, {start})', fnNormalized, responses)
    ).toBe(20);
  });

  it('today returns a YYYY-MM-DD string', () => {
    const result = evaluateExpression('today()', fnNormalized, responses);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('year extracts the UTC year', () => {
    expect(evaluateExpression('year({start})', fnNormalized, responses)).toBe(
      2026
    );
  });

  it('addDays returns empty string when the date is missing', () => {
    expect(
      evaluateExpression('addDays({missing}, 5)', fnNormalized, responses)
    ).toBe('');
  });

  it('supports nested date arithmetic in a comparison', () => {
    // start + days = 2026-01-11, which is before other (2026-01-21)
    expect(
      evaluateExpression(
        'diffDays({other}, addDays({start}, {days})) === 10',
        fnNormalized,
        responses
      )
    ).toBe(true);
  });

  it('min / max / round / abs operate on numbers', () => {
    expect(evaluateExpression('min(3, 7, 2)', fnNormalized, responses)).toBe(2);
    expect(evaluateExpression('max(3, 7, 2)', fnNormalized, responses)).toBe(7);
    expect(evaluateExpression('round(2.6)', fnNormalized, responses)).toBe(3);
    expect(evaluateExpression('abs(0 - 5)', fnNormalized, responses)).toBe(5);
  });

  it('if evaluates lazily and returns the taken branch', () => {
    expect(
      evaluateExpression(
        "if({flag} === 1, 'yes', 'no')",
        fnNormalized,
        responses
      )
    ).toBe('yes');
    expect(
      evaluateExpression(
        "if({flag} === 2, 'yes', 'no')",
        fnNormalized,
        responses
      )
    ).toBe('no');
  });

  it('returns null for unknown functions', () => {
    expect(
      evaluateExpression('bogus(1, 2)', fnNormalized, responses)
    ).toBeNull();
  });
});
