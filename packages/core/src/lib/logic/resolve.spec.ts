import { describe, it, expect } from 'vitest';
import { resolveEffect } from './resolve.js';
import type { ConditionalRule, FieldDefinition } from '../types.js';
import { normalizeDefinition } from '../functions/normalize.js';
import type { FormResponse } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal field definition with optional rules & required. */
function def(
  id: string,
  opts?: { required?: boolean; rules?: ConditionalRule[] },
): FieldDefinition {
  return { id, fieldType: 'text', ...opts } as FieldDefinition;
}

/** Build a simple "equals" visibility/enable/required rule. */
function makeRule(
  effect: ConditionalRule['effect'],
  targetId: string,
  expected: string,
  logic: ConditionalRule['logic'] = 'AND',
): ConditionalRule {
  return {
    effect,
    logic,
    conditions: [{ targetId, operator: 'equals', expected }],
  };
}

/** Quick normalized state from a flat field list. */
function norm(fields: FieldDefinition[]) {
  return normalizeDefinition(fields);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveEffect', () => {
  // -----------------------------------------------------------------------
  // Defaults (no matching rules)
  // -----------------------------------------------------------------------

  describe('defaults when no rules exist', () => {
    const field = def('q1');
    const normalized = norm([field, def('q2')]);
    const responses: FormResponse = {};

    it('visible defaults to true', () => {
      expect(resolveEffect('visible', field, normalized, responses)).toBe(true);
    });

    it('enable defaults to true', () => {
      expect(resolveEffect('enable', field, normalized, responses)).toBe(true);
    });

    it('required defaults to false', () => {
      expect(resolveEffect('required', field, normalized, responses)).toBe(false);
    });
  });

  describe('required falls back to static field.required', () => {
    it('returns true when field.required is true and no required rule', () => {
      const field = def('q1', { required: true });
      const normalized = norm([field, def('q2')]);
      expect(resolveEffect('required', field, normalized, {})).toBe(true);
    });

    it('returns false when field.required is false and no required rule', () => {
      const field = def('q1', { required: false });
      const normalized = norm([field, def('q2')]);
      expect(resolveEffect('required', field, normalized, {})).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Rules filtering by effect
  // -----------------------------------------------------------------------

  describe('filters rules by effect', () => {
    const target = def('target');
    const normalized = norm([def('q1'), target]);

    it('ignores rules with a different effect', () => {
      const field = def('q1', {
        rules: [makeRule('enable', 'target', 'yes')],
      });
      // Asking for 'visible' — should get default true, not the enable rule
      expect(
        resolveEffect('visible', field, normalized, { target: { answer: 'no' } }),
      ).toBe(true);
    });

    it('evaluates only rules matching the requested effect', () => {
      const field = def('q1', {
        rules: [
          makeRule('visible', 'target', 'yes'),
          makeRule('enable', 'target', 'no'),
        ],
      });
      // visible rule expects 'yes', response is 'no' → false
      expect(
        resolveEffect('visible', field, normalized, { target: { answer: 'no' } }),
      ).toBe(false);
      // enable rule expects 'no', response is 'no' → true
      expect(
        resolveEffect('enable', field, normalized, { target: { answer: 'no' } }),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Single rule evaluation
  // -----------------------------------------------------------------------

  describe('single rule', () => {
    const target = def('target');
    const normalized = norm([def('q1'), target]);

    it('returns true when rule passes', () => {
      const field = def('q1', {
        rules: [makeRule('visible', 'target', 'yes')],
      });
      expect(
        resolveEffect('visible', field, normalized, { target: { answer: 'yes' } }),
      ).toBe(true);
    });

    it('returns false when rule fails', () => {
      const field = def('q1', {
        rules: [makeRule('visible', 'target', 'yes')],
      });
      expect(
        resolveEffect('visible', field, normalized, { target: { answer: 'no' } }),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple rules — OR across rules
  // -----------------------------------------------------------------------

  describe('multiple matching rules (OR across rules)', () => {
    const t1 = def('t1');
    const t2 = def('t2');
    const normalized = norm([def('q1'), t1, t2]);

    it('returns true if any rule passes', () => {
      const field = def('q1', {
        rules: [
          makeRule('visible', 't1', 'yes'),
          makeRule('visible', 't2', 'yes'),
        ],
      });
      // Only t2 matches
      expect(
        resolveEffect('visible', field, normalized, {
          t1: { answer: 'no' },
          t2: { answer: 'yes' },
        }),
      ).toBe(true);
    });

    it('returns false if all rules fail', () => {
      const field = def('q1', {
        rules: [
          makeRule('visible', 't1', 'yes'),
          makeRule('visible', 't2', 'yes'),
        ],
      });
      expect(
        resolveEffect('visible', field, normalized, {
          t1: { answer: 'no' },
          t2: { answer: 'no' },
        }),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Required with conditional override
  // -----------------------------------------------------------------------

  describe('required with conditional rules', () => {
    const target = def('target');
    const normalized = norm([def('q1'), target]);

    it('overrides static required=false when rule passes', () => {
      const field = def('q1', {
        required: false,
        rules: [makeRule('required', 'target', 'yes')],
      });
      expect(
        resolveEffect('required', field, normalized, { target: { answer: 'yes' } }),
      ).toBe(true);
    });

    it('returns false when static required=true but required rule fails', () => {
      // When a conditional required rule exists, it takes over —
      // the static value is ignored.
      const field = def('q1', {
        required: true,
        rules: [makeRule('required', 'target', 'yes')],
      });
      expect(
        resolveEffect('required', field, normalized, { target: { answer: 'no' } }),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Edge: empty conditions array in rule → vacuous truth
  // -----------------------------------------------------------------------

  it('rule with empty conditions is vacuously true', () => {
    const field = def('q1', {
      rules: [{ effect: 'visible' as const, logic: 'AND' as const, conditions: [] }],
    });
    const normalized = norm([field]);
    expect(resolveEffect('visible', field, normalized, {})).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Edge: unknown target in condition → rule fails
  // -----------------------------------------------------------------------

  it('rule referencing unknown target fails gracefully', () => {
    const field = def('q1', {
      rules: [makeRule('visible', 'nonexistent', 'yes')],
    });
    const normalized = norm([field]);
    expect(resolveEffect('visible', field, normalized, {})).toBe(false);
  });
});
