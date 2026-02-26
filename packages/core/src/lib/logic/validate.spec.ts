import { describe, it, expect } from 'vitest';
import { validateField, validateForm } from './validate.js';
import type { FieldDefinition, ConditionalRule } from '../types.js';
import { normalizeDefinition } from '../functions/normalize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function def(
  id: string,
  fieldType: string = 'text',
  opts?: Partial<FieldDefinition>
): FieldDefinition {
  return { id, fieldType, ...opts } as FieldDefinition;
}

function norm(fields: FieldDefinition[]) {
  return normalizeDefinition(fields);
}

function requiredRule(targetId: string, expected: string): ConditionalRule {
  return {
    effect: 'required',
    logic: 'AND',
    conditions: [{ targetId, operator: 'equals', expected }],
  };
}

function visibleRule(targetId: string, expected: string): ConditionalRule {
  return {
    effect: 'visible',
    logic: 'AND',
    conditions: [{ targetId, operator: 'equals', expected }],
  };
}

// ---------------------------------------------------------------------------
// validateField
// ---------------------------------------------------------------------------

describe('validateField', () => {
  // -----------------------------------------------------------------------
  // Required — basic
  // -----------------------------------------------------------------------

  describe('required check', () => {
    it('returns error when required field has no response', () => {
      const field = def('q1', 'text', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {});
      expect(errors).toEqual([
        { fieldId: 'q1', rule: 'required', message: 'This field is required' },
      ]);
    });

    it('returns error when required field has undefined response', () => {
      const field = def('q1', 'text', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, { q1: {} });
      expect(errors).toEqual([
        { fieldId: 'q1', rule: 'required', message: 'This field is required' },
      ]);
    });

    it('returns no error when required field has answer', () => {
      const field = def('q1', 'text', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { answer: 'hello' },
      });
      expect(errors).toEqual([]);
    });

    it('returns no error when field is not required', () => {
      const field = def('q1', 'text');
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {});
      expect(errors).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Required — edge cases for "empty"
  // -----------------------------------------------------------------------

  describe('empty response edge cases', () => {
    it('whitespace-only string is empty', () => {
      const field = def('q1', 'text', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, { q1: { answer: '   ' } });
      expect(errors).toHaveLength(1);
    });

    it('empty string is empty', () => {
      const field = def('q1', 'text', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, { q1: { answer: '' } });
      expect(errors).toHaveLength(1);
    });

    it('boolean false is NOT empty (valid answer)', () => {
      const field = def('q1', 'boolean', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { answer: 'false' as string },
      });
      expect(errors).toEqual([]);
    });

    it('numeric 0 as string is NOT empty (valid answer)', () => {
      const field = def('q1', 'text', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, { q1: { answer: '0' } });
      expect(errors).toEqual([]);
    });

    it('empty selected array is empty', () => {
      const field = def('q1', 'check', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, { q1: { selected: [] } });
      expect(errors).toHaveLength(1);
    });

    it('non-empty selected array is NOT empty', () => {
      const field = def('q1', 'radio', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { selected: { id: 'opt1', value: 'Yes' } },
      });
      expect(errors).toEqual([]);
    });

    it('empty multitextAnswers is empty', () => {
      const field = def('q1', 'multitext', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { multitextAnswers: { a: '', b: '  ' } },
      });
      expect(errors).toHaveLength(1);
    });

    it('non-empty multitextAnswers is NOT empty', () => {
      const field = def('q1', 'multitext', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { multitextAnswers: { a: '', b: 'hello' } },
      });
      expect(errors).toEqual([]);
    });

    it('signatureData present is NOT empty', () => {
      const field = def('q1', 'signature', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { signatureData: 'stroke-data...' },
      });
      expect(errors).toEqual([]);
    });

    it('markupData present is NOT empty', () => {
      const field = def('q1', 'diagram', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { markupData: 'markup-data...' },
      });
      expect(errors).toEqual([]);
    });

    it('matrix record with entries is NOT empty', () => {
      const field = def('q1', 'singlematrix', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { selected: { row1: { id: 'col1', value: 'A' } } },
      });
      expect(errors).toEqual([]);
    });

    it('empty matrix record is empty', () => {
      const field = def('q1', 'singlematrix', { required: true });
      const normalized = norm([field]);
      const errors = validateField('q1', normalized, {
        q1: { selected: {} as never },
      });
      expect(errors).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Non-input field types — skip validation
  // -----------------------------------------------------------------------

  describe('non-input field types are skipped', () => {
    it.each(['section', 'expression', 'html', 'image'] as const)(
      '%s — no error even if required',
      (fieldType) => {
        const field = def('q1', fieldType, { required: true });
        const normalized = norm([field]);
        const errors = validateField('q1', normalized, {});
        expect(errors).toEqual([]);
      }
    );
  });

  // -----------------------------------------------------------------------
  // Hidden fields — skip validation
  // -----------------------------------------------------------------------

  describe('hidden fields are skipped', () => {
    it('no error when required field is hidden by visibility rule', () => {
      const trigger = def('trigger', 'text');
      const field = def('q1', 'text', {
        required: true,
        rules: [visibleRule('trigger', 'show')],
      });
      const normalized = norm([trigger, field]);
      // trigger answer is NOT 'show' → field is hidden → skip
      const errors = validateField('q1', normalized, {
        trigger: { answer: 'hide' },
      });
      expect(errors).toEqual([]);
    });

    it('validates when required field is visible', () => {
      const trigger = def('trigger', 'text');
      const field = def('q1', 'text', {
        required: true,
        rules: [visibleRule('trigger', 'show')],
      });
      const normalized = norm([trigger, field]);
      // trigger answer IS 'show' → field is visible → required + empty → error
      const errors = validateField('q1', normalized, {
        trigger: { answer: 'show' },
      });
      expect(errors).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Conditional required
  // -----------------------------------------------------------------------

  describe('conditional required', () => {
    it('required when rule passes and response is empty', () => {
      const trigger = def('trigger', 'text');
      const field = def('q1', 'text', {
        rules: [requiredRule('trigger', 'yes')],
      });
      const normalized = norm([trigger, field]);
      const errors = validateField('q1', normalized, {
        trigger: { answer: 'yes' },
      });
      expect(errors).toHaveLength(1);
    });

    it('not required when rule fails', () => {
      const trigger = def('trigger', 'text');
      const field = def('q1', 'text', {
        rules: [requiredRule('trigger', 'yes')],
      });
      const normalized = norm([trigger, field]);
      const errors = validateField('q1', normalized, {
        trigger: { answer: 'no' },
      });
      expect(errors).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Unknown field ID
  // -----------------------------------------------------------------------

  it('returns empty for unknown fieldId', () => {
    const normalized = norm([def('q1')]);
    expect(validateField('unknown', normalized, {})).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateForm
// ---------------------------------------------------------------------------

describe('validateForm', () => {
  it('collects errors from multiple fields', () => {
    const q1 = def('q1', 'text', { required: true });
    const q2 = def('q2', 'text', { required: true });
    const q3 = def('q3', 'text');
    const normalized = norm([q1, q2, q3]);
    const errors = validateForm(normalized, {});
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.fieldId).sort()).toEqual(['q1', 'q2']);
  });

  it('returns empty when all required fields are answered', () => {
    const q1 = def('q1', 'text', { required: true });
    const q2 = def('q2', 'radio', { required: true });
    const normalized = norm([q1, q2]);
    const errors = validateForm(normalized, {
      q1: { answer: 'hello' },
      q2: { selected: { id: 'opt1', value: 'Yes' } },
    });
    expect(errors).toEqual([]);
  });

  it('returns empty for form with no required fields', () => {
    const normalized = norm([def('q1'), def('q2')]);
    expect(validateForm(normalized, {})).toEqual([]);
  });

  it('skips non-input types in form-level validation', () => {
    const q1 = def('q1', 'text', { required: true });
    const s1 = def('s1', 'section', { required: true });
    const normalized = norm([q1, s1]);
    const errors = validateForm(normalized, {});
    // Only q1 should error, not s1
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldId).toBe('q1');
  });
});
