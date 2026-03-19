import { describe, it, expect } from 'vitest';
import { resolveEffect } from './resolve.js';
import { normalizeDefinition } from '../functions/normalize.js';
import type {
  ConditionalRule,
  FieldDefinition,
  FieldResponse,
  FormResponse,
} from '../types.js';
import type { NormalizedDefinition } from '../functions/normalize.js';

// ---------------------------------------------------------------------------
// This integration test mirrors the comprehensive test schema and verifies
// that every operator, condition type, effect, and logic mode produces the
// correct result via the full normalizeDefinition → resolveEffect pipeline.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared driver field definitions (Section 1 of the schema)
// ---------------------------------------------------------------------------

const DRIVERS: FieldDefinition[] = [
  {
    id: 'drv-radio',
    fieldType: 'radio',
    question: 'Driver Radio',
    options: [
      { id: 'drv-radio-a', value: 'alpha' },
      { id: 'drv-radio-b', value: 'bravo' },
      { id: 'drv-radio-c', value: 'charlie' },
    ],
  },
  { id: 'drv-text', fieldType: 'text', question: 'Driver Text', inputType: 'string' },
  { id: 'drv-number', fieldType: 'text', question: 'Driver Number', inputType: 'number' },
  {
    id: 'drv-check',
    fieldType: 'check',
    question: 'Driver Check',
    options: [
      { id: 'drv-chk-x', value: 'x-ray' },
      { id: 'drv-chk-y', value: 'yankee' },
      { id: 'drv-chk-z', value: 'zulu' },
    ],
  },
  {
    id: 'drv-dropdown',
    fieldType: 'dropdown',
    question: 'Driver Dropdown',
    options: [
      { id: 'drv-dd-s', value: 'small' },
      { id: 'drv-dd-m', value: 'medium' },
      { id: 'drv-dd-l', value: 'large' },
    ],
  },
  {
    id: 'drv-multiselect',
    fieldType: 'multiselectdropdown',
    question: 'Driver MultiSelect',
    options: [
      { id: 'drv-ms-r', value: 'red' },
      { id: 'drv-ms-g', value: 'green' },
      { id: 'drv-ms-b', value: 'blue' },
    ],
  },
  {
    id: 'drv-boolean',
    fieldType: 'boolean',
    question: 'Driver Boolean',
    options: [
      { id: 'drv-bool-y', value: 'yes' },
      { id: 'drv-bool-n', value: 'no' },
    ],
  },
  {
    id: 'drv-slider',
    fieldType: 'slider',
    question: 'Driver Slider',
    options: Array.from({ length: 10 }, (_, i) => ({
      id: `drv-sl-${i + 1}`,
      value: String(i + 1),
    })),
  },
  {
    id: 'drv-rating',
    fieldType: 'rating',
    question: 'Driver Rating',
    options: Array.from({ length: 5 }, (_, i) => ({
      id: `drv-rt-${i + 1}`,
      value: String(i + 1),
    })),
  },
  {
    id: 'drv-ranking',
    fieldType: 'ranking',
    question: 'Driver Ranking',
    options: [
      { id: 'drv-rk-1', value: 'first' },
      { id: 'drv-rk-2', value: 'second' },
      { id: 'drv-rk-3', value: 'third' },
    ],
  },
  { id: 'drv-longtext', fieldType: 'longtext', question: 'Driver LongText' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fieldRule(
  effect: ConditionalRule['effect'],
  targetId: string,
  operator: string,
  expected?: string,
  logic: ConditionalRule['logic'] = 'AND'
): ConditionalRule {
  return {
    effect,
    logic,
    conditions: [
      {
        conditionType: 'field',
        targetId,
        operator: operator as ConditionalRule['conditions'][0]['operator'],
        ...(expected !== undefined ? { expected } : {}),
      },
    ],
  };
}

function exprRule(
  effect: ConditionalRule['effect'],
  expression: string,
  logic: ConditionalRule['logic'] = 'AND'
): ConditionalRule {
  return {
    effect,
    logic,
    conditions: [{ conditionType: 'expression', expression }],
  };
}

/** Build normalized state with drivers + the target field under test. */
function setup(targetField: FieldDefinition): {
  normalized: NormalizedDefinition;
  field: FieldDefinition;
} {
  const allFields = [...DRIVERS, targetField];
  return { normalized: normalizeDefinition(allFields), field: targetField };
}

function sel(id: string, value: string): { id: string; value: string } {
  return { id, value };
}

// ---------------------------------------------------------------------------
// § 2  Field-based conditions — every operator
// ---------------------------------------------------------------------------

describe('comprehensive conditions integration', () => {
  describe('field-based conditions (conditionType: field)', () => {
    // ----- equals -----

    describe('equals', () => {
      it('radio — matches selected option ID', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-radio', 'equals', 'drv-radio-a')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        })).toBe(true);
      });

      it('radio — does not match different option', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-radio', 'equals', 'drv-radio-a')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-radio': { selected: sel('drv-radio-b', 'bravo') },
        })).toBe(false);
      });

      it('text — exact string match', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'equals', 'hello')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: 'hello' },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: 'world' },
        })).toBe(false);
      });

      it('dropdown — matches option ID', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-dropdown', 'equals', 'drv-dd-m')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-dropdown': { selected: sel('drv-dd-m', 'medium') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-dropdown': { selected: sel('drv-dd-s', 'small') },
        })).toBe(false);
      });

      it('boolean — matches option ID', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-boolean', 'equals', 'drv-bool-y')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-boolean': { selected: sel('drv-bool-y', 'yes') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-boolean': { selected: sel('drv-bool-n', 'no') },
        })).toBe(false);
      });
    });

    // ----- notEquals -----

    describe('notEquals', () => {
      it('radio — true when different option selected', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-radio', 'notEquals', 'drv-radio-a')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-radio': { selected: sel('drv-radio-b', 'bravo') },
        })).toBe(true);
      });

      it('radio — false when same option selected', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-radio', 'notEquals', 'drv-radio-a')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        })).toBe(false);
      });

      it('text — true when strings differ', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'notEquals', 'hello')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: 'world' },
        })).toBe(true);
      });

      it('dropdown — true when different option', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-dropdown', 'notEquals', 'drv-dd-m')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-dropdown': { selected: sel('drv-dd-l', 'large') },
        })).toBe(true);
      });
    });

    // ----- contains -----

    describe('contains', () => {
      it('text — word present', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'contains', 'world')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: 'hello world' },
        })).toBe(true);
      });

      it('text — word absent', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'contains', 'world')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: 'hello there' },
        })).toBe(false);
      });

      it('longtext — word present', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-longtext', 'contains', 'test')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-longtext': { answer: 'this is a test paragraph' },
        })).toBe(true);
      });
    });

    // ----- includes -----

    describe('includes', () => {
      it('check — option present in selection', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-check', 'includes', 'drv-chk-y')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-check': { selected: [sel('drv-chk-x', 'x-ray'), sel('drv-chk-y', 'yankee')] },
        })).toBe(true);
      });

      it('check — option absent from selection', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-check', 'includes', 'drv-chk-y')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-check': { selected: [sel('drv-chk-x', 'x-ray')] },
        })).toBe(false);
      });

      it('multiselectdropdown — option present', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-multiselect', 'includes', 'drv-ms-g')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-multiselect': { selected: [sel('drv-ms-g', 'green'), sel('drv-ms-b', 'blue')] },
        })).toBe(true);
      });

      it('ranking — option present', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-ranking', 'includes', 'drv-rk-2')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-ranking': { selected: [sel('drv-rk-1', 'first'), sel('drv-rk-2', 'second'), sel('drv-rk-3', 'third')] },
        })).toBe(true);
      });
    });

    // ----- empty / notEmpty -----

    describe('empty / notEmpty', () => {
      it('text — empty when no response', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'empty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {})).toBe(true);
      });

      it('text — empty when blank string', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'empty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: '' },
        })).toBe(true);
      });

      it('text — notEmpty when has value', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-text', 'notEmpty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-text': { answer: 'hi' },
        })).toBe(true);
      });

      it('radio — empty when no selection', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-radio', 'empty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {})).toBe(true);
      });

      it('radio — notEmpty when has selection', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-radio', 'notEmpty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        })).toBe(true);
      });

      it('check — empty when no ticks', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-check', 'empty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-check': { selected: [] },
        })).toBe(true);
      });

      it('check — notEmpty when has ticks', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-check', 'notEmpty')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-check': { selected: [sel('drv-chk-x', 'x-ray')] },
        })).toBe(true);
      });
    });

    // ----- numeric operators -----

    describe('numeric operators', () => {
      it('greaterThan — slider value > 5', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-slider', 'greaterThan', '5')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-slider': { selected: sel('drv-sl-6', '6') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-slider': { selected: sel('drv-sl-5', '5') },
        })).toBe(false);
        expect(resolveEffect('visible', field, normalized, {
          'drv-slider': { selected: sel('drv-sl-4', '4') },
        })).toBe(false);
      });

      it('greaterThanOrEqual — rating value >= 3', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-rating', 'greaterThanOrEqual', '3')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-rating': { selected: sel('drv-rt-3', '3') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-rating': { selected: sel('drv-rt-4', '4') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-rating': { selected: sel('drv-rt-2', '2') },
        })).toBe(false);
      });

      it('lessThan — slider value < 5', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-slider', 'lessThan', '5')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-slider': { selected: sel('drv-sl-4', '4') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-slider': { selected: sel('drv-sl-5', '5') },
        })).toBe(false);
      });

      it('lessThanOrEqual — rating value <= 2', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-rating', 'lessThanOrEqual', '2')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-rating': { selected: sel('drv-rt-2', '2') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-rating': { selected: sel('drv-rt-1', '1') },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-rating': { selected: sel('drv-rt-3', '3') },
        })).toBe(false);
      });

      it('greaterThan — number text input > 50', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-number', 'greaterThan', '50')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-number': { answer: '75' },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-number': { answer: '25' },
        })).toBe(false);
      });

      it('lessThan — number text input < 50', () => {
        const f: FieldDefinition = {
          id: 'target', fieldType: 'text', question: 'T',
          rules: [fieldRule('visible', 'drv-number', 'lessThan', '50')],
        };
        const { normalized, field } = setup(f);
        expect(resolveEffect('visible', field, normalized, {
          'drv-number': { answer: '25' },
        })).toBe(true);
        expect(resolveEffect('visible', field, normalized, {
          'drv-number': { answer: '75' },
        })).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // § 3  Expression-based conditions
  // -------------------------------------------------------------------------

  describe('expression-based conditions (conditionType: expression)', () => {
    it('> comparison', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} > 7')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-8', '8') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-7', '7') },
      })).toBe(false);
    });

    it('< comparison', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} < 3')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-2', '2') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      })).toBe(false);
    });

    it('>= comparison', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-rating} >= 4')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-rating': { selected: sel('drv-rt-4', '4') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-rating': { selected: sel('drv-rt-3', '3') },
      })).toBe(false);
    });

    it('<= comparison', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-rating} <= 2')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-rating': { selected: sel('drv-rt-2', '2') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-rating': { selected: sel('drv-rt-3', '3') },
      })).toBe(false);
    });

    it('== comparison', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} == 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-4', '4') },
      })).toBe(false);
    });

    it('!= comparison', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} != 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-4', '4') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
      })).toBe(false);
    });

    it('&& — both sides true', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} > 3 && {drv-rating} > 2')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
        'drv-rating': { selected: sel('drv-rt-3', '3') },
      })).toBe(true);
    });

    it('&& — one side false', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} > 3 && {drv-rating} > 2')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
        'drv-rating': { selected: sel('drv-rt-1', '1') },
      })).toBe(false);
    });

    it('|| — one side true', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} > 8 || {drv-rating} > 4')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-3', '3') },
        'drv-rating': { selected: sel('drv-rt-5', '5') },
      })).toBe(true);
    });

    it('|| — both sides false', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} > 8 || {drv-rating} > 4')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-3', '3') },
        'drv-rating': { selected: sel('drv-rt-2', '2') },
      })).toBe(false);
    });

    it('! negation', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '!({drv-slider} > 5)')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-4', '4') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-6', '6') },
      })).toBe(false);
    });

    it('complex arithmetic: (slider * rating) > 20', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '({drv-slider} * {drv-rating}) > 20')],
      };
      const { normalized, field } = setup(f);
      // 5 * 5 = 25 > 20
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
        'drv-rating': { selected: sel('drv-rt-5', '5') },
      })).toBe(true);
      // 3 * 3 = 9 ≤ 20
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-3', '3') },
        'drv-rating': { selected: sel('drv-rt-3', '3') },
      })).toBe(false);
    });

    it('member access: .length', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-text}.length > 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-text': { answer: 'abcdef' },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-text': { answer: 'abc' },
      })).toBe(false);
    });

    it('number text field in expression', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-number} > 100')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-number': { answer: '150' },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-number': { answer: '50' },
      })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 4  Conditional effects (visible / enable / required)
  // -------------------------------------------------------------------------

  describe('conditional effects', () => {
    const boolYes: FormResponse = { 'drv-boolean': { selected: sel('drv-bool-y', 'yes') } };
    const boolNo: FormResponse = { 'drv-boolean': { selected: sel('drv-bool-n', 'no') } };

    it('visible — shown when condition met, hidden otherwise', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'drv-boolean', 'equals', 'drv-bool-y')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, boolYes)).toBe(true);
      expect(resolveEffect('visible', field, normalized, boolNo)).toBe(false);
    });

    it('enable — enabled when condition met, disabled otherwise', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('enable', 'drv-boolean', 'equals', 'drv-bool-y')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('enable', field, normalized, boolYes)).toBe(true);
      expect(resolveEffect('enable', field, normalized, boolNo)).toBe(false);
    });

    it('required — required when condition met, not required otherwise', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('required', 'drv-boolean', 'equals', 'drv-bool-y')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('required', field, normalized, boolYes)).toBe(true);
      expect(resolveEffect('required', field, normalized, boolNo)).toBe(false);
    });

    it('multiple effects — visible and required on same field with different conditions', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [
          fieldRule('visible', 'drv-radio', 'notEmpty'),
          exprRule('required', '{drv-slider} > 5'),
        ],
      };
      const { normalized, field } = setup(f);
      const responses: FormResponse = {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        'drv-slider': { selected: sel('drv-sl-7', '7') },
      };
      expect(resolveEffect('visible', field, normalized, responses)).toBe(true);
      expect(resolveEffect('required', field, normalized, responses)).toBe(true);

      // Slider ≤ 5 → not required but still visible
      const responses2: FormResponse = {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      };
      expect(resolveEffect('visible', field, normalized, responses2)).toBe(true);
      expect(resolveEffect('required', field, normalized, responses2)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 5  Logic modes (AND / OR) & mixed conditions
  // -------------------------------------------------------------------------

  describe('logic modes AND / OR', () => {
    it('AND — all conditions must pass', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [{
          effect: 'visible',
          logic: 'AND',
          conditions: [
            { conditionType: 'field', targetId: 'drv-radio', operator: 'equals', expected: 'drv-radio-a' },
            { conditionType: 'field', targetId: 'drv-dropdown', operator: 'equals', expected: 'drv-dd-l' },
          ],
        }],
      };
      const { normalized, field } = setup(f);
      // Both match
      expect(resolveEffect('visible', field, normalized, {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        'drv-dropdown': { selected: sel('drv-dd-l', 'large') },
      })).toBe(true);
      // Only one matches
      expect(resolveEffect('visible', field, normalized, {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        'drv-dropdown': { selected: sel('drv-dd-s', 'small') },
      })).toBe(false);
    });

    it('OR — any condition can pass', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [{
          effect: 'visible',
          logic: 'OR',
          conditions: [
            { conditionType: 'field', targetId: 'drv-radio', operator: 'equals', expected: 'drv-radio-b' },
            { conditionType: 'field', targetId: 'drv-dropdown', operator: 'equals', expected: 'drv-dd-s' },
          ],
        }],
      };
      const { normalized, field } = setup(f);
      // Only second matches
      expect(resolveEffect('visible', field, normalized, {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        'drv-dropdown': { selected: sel('drv-dd-s', 'small') },
      })).toBe(true);
      // Neither matches
      expect(resolveEffect('visible', field, normalized, {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
        'drv-dropdown': { selected: sel('drv-dd-l', 'large') },
      })).toBe(false);
    });

    it('mixed AND — field + expression conditions together', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [{
          effect: 'visible',
          logic: 'AND',
          conditions: [
            { conditionType: 'field', targetId: 'drv-boolean', operator: 'equals', expected: 'drv-bool-y' },
            { conditionType: 'expression', expression: '{drv-slider} > 5' },
          ],
        }],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-y', 'yes') },
        'drv-slider': { selected: sel('drv-sl-7', '7') },
      })).toBe(true);
      // Boolean yes but slider ≤ 5
      expect(resolveEffect('visible', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-y', 'yes') },
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      })).toBe(false);
    });

    it('mixed OR — field + expression, either works', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [{
          effect: 'visible',
          logic: 'OR',
          conditions: [
            { conditionType: 'field', targetId: 'drv-text', operator: 'contains', expected: 'special' },
            { conditionType: 'expression', expression: '{drv-slider} == 10' },
          ],
        }],
      };
      const { normalized, field } = setup(f);
      // Text contains special, slider ≠ 10
      expect(resolveEffect('visible', field, normalized, {
        'drv-text': { answer: 'something special here' },
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      })).toBe(true);
      // Text doesn't contain special, slider = 10
      expect(resolveEffect('visible', field, normalized, {
        'drv-text': { answer: 'nothing here' },
        'drv-slider': { selected: sel('drv-sl-10', '10') },
      })).toBe(true);
      // Neither
      expect(resolveEffect('visible', field, normalized, {
        'drv-text': { answer: 'nothing here' },
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 6  Conditional sections (rules on section itself)
  // -------------------------------------------------------------------------

  describe('conditional sections', () => {
    it('section with visibility rule is hidden when condition not met', () => {
      const section: FieldDefinition = {
        id: 'conditional-section',
        fieldType: 'section',
        title: 'Hidden Section',
        rules: [fieldRule('visible', 'drv-radio', 'equals', 'drv-radio-c')],
        fields: [
          { id: 'inner-text', fieldType: 'text', question: 'Inner' },
        ],
      };
      const allFields: FieldDefinition[] = [...DRIVERS, section];
      const normalized = normalizeDefinition(allFields);
      expect(resolveEffect('visible', section, normalized, {
        'drv-radio': { selected: sel('drv-radio-c', 'charlie') },
      })).toBe(true);
      expect(resolveEffect('visible', section, normalized, {
        'drv-radio': { selected: sel('drv-radio-a', 'alpha') },
      })).toBe(false);
    });

    it('nested condition inside a conditional section', () => {
      const innerRadio: FieldDefinition = {
        id: 'cs-inner-radio',
        fieldType: 'radio',
        question: 'Inner',
        options: [
          { id: 'cs-r-show', value: 'show' },
          { id: 'cs-r-hide', value: 'hide' },
        ],
      };
      const nestedField: FieldDefinition = {
        id: 'cs-nested',
        fieldType: 'text',
        question: 'Nested',
        rules: [fieldRule('visible', 'cs-inner-radio', 'equals', 'cs-r-show')],
      };
      const section: FieldDefinition = {
        id: 'conditional-section',
        fieldType: 'section',
        title: 'Hidden Section',
        rules: [fieldRule('visible', 'drv-radio', 'equals', 'drv-radio-c')],
        fields: [innerRadio, nestedField],
      };
      const allFields: FieldDefinition[] = [...DRIVERS, section];
      const normalized = normalizeDefinition(allFields);

      // Nested field visible when inner radio = show
      expect(resolveEffect('visible', nestedField, normalized, {
        'drv-radio': { selected: sel('drv-radio-c', 'charlie') },
        'cs-inner-radio': { selected: sel('cs-r-show', 'show') },
      })).toBe(true);

      // Nested field hidden when inner radio = hide
      expect(resolveEffect('visible', nestedField, normalized, {
        'drv-radio': { selected: sel('drv-radio-c', 'charlie') },
        'cs-inner-radio': { selected: sel('cs-r-hide', 'hide') },
      })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 7  Rich content fields with conditions
  // -------------------------------------------------------------------------

  describe('rich content fields with conditions', () => {
    it('html field — conditional visibility via expression', () => {
      const f: FieldDefinition = {
        id: 'rc-html-conditional',
        fieldType: 'html',
        htmlContent: '<p>Conditional HTML</p>',
        rules: [exprRule('visible', '{drv-slider} > 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-7', '7') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      })).toBe(false);
    });

    it('display field — conditional visibility via compound expression', () => {
      const f: FieldDefinition = {
        id: 'rc-display-conditional',
        fieldType: 'display',
        question: 'Display',
        content: 'Content with {drv-slider}',
        rules: [exprRule('visible', '{drv-slider} > 5 && {drv-rating} > 3')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-7', '7') },
        'drv-rating': { selected: sel('drv-rt-4', '4') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-7', '7') },
        'drv-rating': { selected: sel('drv-rt-2', '2') },
      })).toBe(false);
    });

    it('image field — conditional visibility', () => {
      const f: FieldDefinition = {
        id: 'rc-image-cond',
        fieldType: 'image',
        question: 'Image',
        imageUri: 'https://example.com/img.png',
        rules: [fieldRule('visible', 'drv-boolean', 'equals', 'drv-bool-y')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-y', 'yes') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-n', 'no') },
      })).toBe(false);
    });

    it('signature field — conditional visibility', () => {
      const f: FieldDefinition = {
        id: 'rc-signature-cond',
        fieldType: 'signature',
        question: 'Signature',
        rules: [exprRule('visible', '{drv-slider} >= 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-2', '2') },
      })).toBe(false);
    });

    it('diagram field — conditional visibility', () => {
      const f: FieldDefinition = {
        id: 'rc-diagram-cond',
        fieldType: 'diagram',
        question: 'Diagram',
        rules: [exprRule('visible', '{drv-slider} >= 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-5', '5') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-2', '2') },
      })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 8  Matrix fields with conditions
  // -------------------------------------------------------------------------

  describe('matrix fields with conditions', () => {
    it('singlematrix — conditional visibility', () => {
      const f: FieldDefinition = {
        id: 'mx-conditional',
        fieldType: 'singlematrix',
        question: 'Matrix',
        rows: [{ id: 'r1', value: 'Row 1' }],
        columns: [{ id: 'c1', value: 'Col 1' }],
        rules: [fieldRule('visible', 'drv-boolean', 'equals', 'drv-bool-y')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-y', 'yes') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-n', 'no') },
      })).toBe(false);
    });

    it('multimatrix — conditional visibility', () => {
      const f: FieldDefinition = {
        id: 'mx-multi-cond',
        fieldType: 'multimatrix',
        question: 'Multi Matrix',
        rows: [{ id: 'r1', value: 'Row 1' }],
        columns: [{ id: 'c1', value: 'Col 1' }],
        rules: [exprRule('visible', '{drv-slider} > 5')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-7', '7') },
      })).toBe(true);
      expect(resolveEffect('visible', field, normalized, {
        'drv-slider': { selected: sel('drv-sl-3', '3') },
      })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 9  Every field type with an expression condition
  // -------------------------------------------------------------------------

  describe('every field type with expression condition', () => {
    const FIELD_TYPE_DEFS: FieldDefinition[] = [
      { id: 'ft-text', fieldType: 'text', question: 'T', inputType: 'string' },
      { id: 'ft-text-num', fieldType: 'text', question: 'T', inputType: 'number' },
      { id: 'ft-text-email', fieldType: 'text', question: 'T', inputType: 'email' },
      { id: 'ft-text-date', fieldType: 'text', question: 'T', inputType: 'date' },
      { id: 'ft-text-tel', fieldType: 'text', question: 'T', inputType: 'tel' },
      { id: 'ft-text-url', fieldType: 'text', question: 'T', inputType: 'url' },
      { id: 'ft-text-time', fieldType: 'text', question: 'T', inputType: 'time' },
      { id: 'ft-text-datetime', fieldType: 'text', question: 'T', inputType: 'datetime-local' },
      { id: 'ft-text-month', fieldType: 'text', question: 'T', inputType: 'month' },
      { id: 'ft-longtext', fieldType: 'longtext', question: 'T' },
      {
        id: 'ft-multitext', fieldType: 'multitext', question: 'T',
        options: [{ id: 'mt-1', value: 'Sub 1' }],
      },
      {
        id: 'ft-radio', fieldType: 'radio', question: 'T',
        options: [{ id: 'r-1', value: 'opt1' }],
      },
      {
        id: 'ft-check', fieldType: 'check', question: 'T',
        options: [{ id: 'c-1', value: 'chk1' }],
      },
      {
        id: 'ft-boolean', fieldType: 'boolean', question: 'T',
        options: [{ id: 'b-y', value: 'yes' }, { id: 'b-n', value: 'no' }],
      },
      {
        id: 'ft-dropdown', fieldType: 'dropdown', question: 'T',
        options: [{ id: 'd-1', value: 'd1' }],
      },
      {
        id: 'ft-multiselectdropdown', fieldType: 'multiselectdropdown', question: 'T',
        options: [{ id: 'msd-1', value: 'ms1' }],
      },
      {
        id: 'ft-rating', fieldType: 'rating', question: 'T',
        options: Array.from({ length: 5 }, (_, i) => ({ id: `rt-${i + 1}`, value: String(i + 1) })),
      },
      {
        id: 'ft-ranking', fieldType: 'ranking', question: 'T',
        options: [{ id: 'rk-1', value: 'rank1' }, { id: 'rk-2', value: 'rank2' }],
      },
      {
        id: 'ft-slider', fieldType: 'slider', question: 'T',
        options: Array.from({ length: 5 }, (_, i) => ({ id: `sl-${i + 1}`, value: String(i + 1) })),
      },
      {
        id: 'ft-singlematrix', fieldType: 'singlematrix', question: 'T',
        rows: [{ id: 'r1', value: 'R1' }], columns: [{ id: 'c1', value: 'C1' }],
      },
      {
        id: 'ft-multimatrix', fieldType: 'multimatrix', question: 'T',
        rows: [{ id: 'r1', value: 'R1' }], columns: [{ id: 'c1', value: 'C1' }],
      },
      { id: 'ft-html', fieldType: 'html', htmlContent: '<p>test</p>' },
      { id: 'ft-image', fieldType: 'image', question: 'T', imageUri: 'test.png' },
      { id: 'ft-display', fieldType: 'display', question: 'T', content: 'text' },
      { id: 'ft-signature', fieldType: 'signature', question: 'T' },
      { id: 'ft-diagram', fieldType: 'diagram', question: 'T' },
    ];

    for (const baseDef of FIELD_TYPE_DEFS) {
      it(`${baseDef.fieldType}${baseDef.inputType ? ` (${baseDef.inputType})` : ''} — visibility rule fires correctly`, () => {
        const f: FieldDefinition = {
          ...baseDef,
          rules: [exprRule('visible', '{drv-slider} >= 3')],
        };
        const allFields = [...DRIVERS, f];
        const normalized = normalizeDefinition(allFields);

        // Slider = 3 → visible
        expect(resolveEffect('visible', f, normalized, {
          'drv-slider': { selected: sel('drv-sl-3', '3') },
        })).toBe(true);

        // Slider = 2 → hidden
        expect(resolveEffect('visible', f, normalized, {
          'drv-slider': { selected: sel('drv-sl-2', '2') },
        })).toBe(false);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('no response at all → empty conditions pass, notEmpty conditions fail', () => {
      const fEmpty: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'drv-text', 'empty')],
      };
      const fNotEmpty: FieldDefinition = {
        id: 'target2', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'drv-text', 'notEmpty')],
      };
      const { normalized } = setup(fEmpty);
      const normalized2 = normalizeDefinition([...DRIVERS, fNotEmpty]);
      expect(resolveEffect('visible', fEmpty, normalized, {})).toBe(true);
      expect(resolveEffect('visible', fNotEmpty, normalized2, {})).toBe(false);
    });

    it('whitespace-only text → treated as empty', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'drv-text', 'empty')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-text': { answer: '   ' },
      })).toBe(true);
    });

    it('NaN in numeric comparison → false', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'drv-number', 'greaterThan', '50')],
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {
        'drv-number': { answer: 'not-a-number' },
      })).toBe(false);
    });

    it('field with no rules → defaults (visible=true, enable=true, required=false)', () => {
      const f: FieldDefinition = { id: 'target', fieldType: 'text', question: 'T' };
      const { normalized, field } = setup(f);
      expect(resolveEffect('visible', field, normalized, {})).toBe(true);
      expect(resolveEffect('enable', field, normalized, {})).toBe(true);
      expect(resolveEffect('required', field, normalized, {})).toBe(false);
    });

    it('static required=true with no required rule → uses static value', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T', required: true,
      };
      const { normalized, field } = setup(f);
      expect(resolveEffect('required', field, normalized, {})).toBe(true);
    });

    it('required rule overrides static required when present', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T', required: true,
        rules: [fieldRule('required', 'drv-boolean', 'equals', 'drv-bool-y')],
      };
      const { normalized, field } = setup(f);
      // Condition not met → required rule returns false (overrides static true)
      expect(resolveEffect('required', field, normalized, {
        'drv-boolean': { selected: sel('drv-bool-n', 'no') },
      })).toBe(false);
    });

    it('expression referencing unanswered field → gracefully false', () => {
      const f: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{drv-slider} > 5')],
      };
      const { normalized, field } = setup(f);
      // No slider response at all
      expect(resolveEffect('visible', field, normalized, {})).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // § 10  FieldResponse shapes — verify condition engine reads every format
  // -------------------------------------------------------------------------

  describe('FieldResponse shapes — condition reads correct answer from each format', () => {
    it('text answer — condition reads from answer property', () => {
      const driver: FieldDefinition = { id: 'src', fieldType: 'text', question: 'Q', inputType: 'string' };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'equals', 'hello')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { answer: 'hello' };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respWrong: FieldResponse = { answer: 'world' };
      expect(resolveEffect('visible', target, normalized, { src: respWrong })).toBe(false);
    });

    it('number text answer — condition reads numeric value from answer', () => {
      const driver: FieldDefinition = { id: 'src', fieldType: 'text', question: 'Q', inputType: 'number' };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'greaterThan', '50')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { answer: '75' };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respLow: FieldResponse = { answer: '25' };
      expect(resolveEffect('visible', target, normalized, { src: respLow })).toBe(false);
    });

    it('single-select (radio) — condition reads option ID from selected', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'radio', question: 'Q',
        options: [{ id: 'opt-a', value: 'A' }, { id: 'opt-b', value: 'B' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'equals', 'opt-a')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: { id: 'opt-a', value: 'A' } };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respB: FieldResponse = { selected: { id: 'opt-b', value: 'B' } };
      expect(resolveEffect('visible', target, normalized, { src: respB })).toBe(false);
    });

    it('single-select (dropdown) — condition reads option ID from selected', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'dropdown', question: 'Q',
        options: [{ id: 'dd-1', value: 'one' }, { id: 'dd-2', value: 'two' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'equals', 'dd-2')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: { id: 'dd-2', value: 'two' } };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);
    });

    it('single-select (boolean) — condition reads option ID from selected', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'boolean', question: 'Q',
        options: [{ id: 'b-y', value: 'yes' }, { id: 'b-n', value: 'no' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'equals', 'b-y')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: { id: 'b-y', value: 'yes' } };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);
    });

    it('single-select (slider) — condition reads numeric value from selected', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'slider', question: 'Q',
        options: Array.from({ length: 5 }, (_, i) => ({ id: `s-${i + 1}`, value: String(i + 1) })),
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'greaterThan', '3')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: { id: 's-4', value: '4' } };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respLow: FieldResponse = { selected: { id: 's-2', value: '2' } };
      expect(resolveEffect('visible', target, normalized, { src: respLow })).toBe(false);
    });

    it('single-select (rating) — condition reads numeric value from selected', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'rating', question: 'Q',
        options: Array.from({ length: 5 }, (_, i) => ({ id: `r-${i + 1}`, value: String(i + 1) })),
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'greaterThanOrEqual', '4')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: { id: 'r-4', value: '4' } };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respLow: FieldResponse = { selected: { id: 'r-2', value: '2' } };
      expect(resolveEffect('visible', target, normalized, { src: respLow })).toBe(false);
    });

    it('multi-select (check) — condition reads from selected array via includes', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'check', question: 'Q',
        options: [{ id: 'c-1', value: 'A' }, { id: 'c-2', value: 'B' }, { id: 'c-3', value: 'C' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'includes', 'c-2')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: [{ id: 'c-1', value: 'A' }, { id: 'c-2', value: 'B' }] };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respMissing: FieldResponse = { selected: [{ id: 'c-1', value: 'A' }] };
      expect(resolveEffect('visible', target, normalized, { src: respMissing })).toBe(false);
    });

    it('multi-select (multiselectdropdown) — condition reads from selected array', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'multiselectdropdown', question: 'Q',
        options: [{ id: 'ms-r', value: 'red' }, { id: 'ms-g', value: 'green' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'includes', 'ms-g')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: [{ id: 'ms-r', value: 'red' }, { id: 'ms-g', value: 'green' }] };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);
    });

    it('multi-select (ranking) — condition reads from selected array', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'ranking', question: 'Q',
        options: [{ id: 'rk-1', value: 'first' }, { id: 'rk-2', value: 'second' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'includes', 'rk-2')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: [{ id: 'rk-1', value: 'first' }, { id: 'rk-2', value: 'second' }] };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);
    });

    it('empty selected array → empty is true', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'check', question: 'Q',
        options: [{ id: 'c-1', value: 'A' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'empty')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: [] };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);
    });

    it('undefined response → empty is true, notEmpty is false', () => {
      const driver: FieldDefinition = { id: 'src', fieldType: 'text', question: 'Q' };
      const targetEmpty: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'empty')],
      };
      const targetNotEmpty: FieldDefinition = {
        id: 'target2', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'notEmpty')],
      };
      const normalized1 = normalizeDefinition([driver, targetEmpty]);
      const normalized2 = normalizeDefinition([driver, targetNotEmpty]);
      const resp: FieldResponse | undefined = undefined;
      expect(resolveEffect('visible', targetEmpty, normalized1, { src: resp as unknown as FieldResponse })).toBe(true);
      expect(resolveEffect('visible', targetNotEmpty, normalized2, {})).toBe(false);
    });

    it('longtext answer — condition reads from answer property', () => {
      const driver: FieldDefinition = { id: 'src', fieldType: 'longtext', question: 'Q' };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [fieldRule('visible', 'src', 'contains', 'keyword')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { answer: 'this paragraph has the keyword inside' };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respMissing: FieldResponse = { answer: 'nothing relevant here' };
      expect(resolveEffect('visible', target, normalized, { src: respMissing })).toBe(false);
    });

    it('expression reads text answer value', () => {
      const driver: FieldDefinition = { id: 'src', fieldType: 'text', question: 'Q', inputType: 'number' };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{src} > 100')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { answer: '150' };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respLow: FieldResponse = { answer: '50' };
      expect(resolveEffect('visible', target, normalized, { src: respLow })).toBe(false);
    });

    it('expression reads selected option value (not ID) for single-select', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'slider', question: 'Q',
        options: Array.from({ length: 10 }, (_, i) => ({ id: `s-${i + 1}`, value: String(i + 1) })),
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{src} >= 7')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: { id: 's-8', value: '8' } };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respLow: FieldResponse = { selected: { id: 's-3', value: '3' } };
      expect(resolveEffect('visible', target, normalized, { src: respLow })).toBe(false);
    });

    it('expression reads .length on text answer', () => {
      const driver: FieldDefinition = { id: 'src', fieldType: 'text', question: 'Q' };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{src}.length > 3')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { answer: 'abcde' };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respShort: FieldResponse = { answer: 'ab' };
      expect(resolveEffect('visible', target, normalized, { src: respShort })).toBe(false);
    });

    it('expression reads .length on multi-select array', () => {
      const driver: FieldDefinition = {
        id: 'src', fieldType: 'check', question: 'Q',
        options: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }, { id: 'c', value: 'C' }],
      };
      const target: FieldDefinition = {
        id: 'target', fieldType: 'text', question: 'T',
        rules: [exprRule('visible', '{src}.length >= 2')],
      };
      const normalized = normalizeDefinition([driver, target]);
      const resp: FieldResponse = { selected: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }] };
      expect(resolveEffect('visible', target, normalized, { src: resp })).toBe(true);

      const respOne: FieldResponse = { selected: [{ id: 'a', value: 'A' }] };
      expect(resolveEffect('visible', target, normalized, { src: respOne })).toBe(false);
    });
  });
});
