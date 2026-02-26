import { describe, it, expect, beforeEach } from 'vitest';
import { createFormEngine } from './store.js';
import type { FormEngine } from './store.js';
import type {
  FormDefinition,
  FieldDefinition,
  FieldType,
  ConditionalRule,
} from '../types.js';
import { SCHEMA_TYPE } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function field(
  id: string,
  fieldType: string = 'text',
  opts?: Partial<FieldDefinition>
): FieldDefinition {
  return { id, fieldType, ...opts } as FieldDefinition;
}

function form(fields: FieldDefinition[]): FormDefinition {
  return { schemaType: SCHEMA_TYPE, fields };
}

function visibleRule(targetId: string, expected: string): ConditionalRule {
  return {
    effect: 'visible',
    logic: 'AND',
    conditions: [{ targetId, operator: 'equals', expected }],
  };
}

function enableRule(targetId: string, expected: string): ConditionalRule {
  return {
    effect: 'enable',
    logic: 'AND',
    conditions: [{ targetId, operator: 'equals', expected }],
  };
}

function requiredRule(targetId: string, expected: string): ConditionalRule {
  return {
    effect: 'required',
    logic: 'AND',
    conditions: [{ targetId, operator: 'equals', expected }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createFormEngine', () => {
  let engine: FormEngine;

  // -----------------------------------------------------------------------
  // Factory
  // -----------------------------------------------------------------------

  describe('factory', () => {
    it('creates engine with no initial definition', () => {
      engine = createFormEngine();
      const s = engine.getState();
      expect(s.normalized.byId).toEqual({});
      expect(s.normalized.rootIds).toEqual([]);
      expect(s.responses).toEqual({});
    });

    it('creates engine with initial definition', () => {
      const def = form([field('q1'), field('q2')]);
      engine = createFormEngine(def);
      const s = engine.getState();
      expect(s.normalized.rootIds).toEqual(['q1', 'q2']);
      expect(s.responses).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  describe('actions', () => {
    beforeEach(() => {
      engine = createFormEngine(form([field('q1'), field('q2')]));
    });

    describe('loadDefinition', () => {
      it('replaces normalized index on load', () => {
        const newDef = form([field('a'), field('b'), field('c')]);
        engine.getState().loadDefinition(newDef);
        const s = engine.getState();
        expect(s.normalized.rootIds).toEqual(['a', 'b', 'c']);
      });

      it('clears responses on load', () => {
        engine.getState().setResponse('q1', { answer: 'hello' });
        engine.getState().loadDefinition(form([field('q1')]));
        expect(engine.getState().responses).toEqual({});
      });
    });

    describe('setResponse', () => {
      it('sets a field response', () => {
        engine.getState().setResponse('q1', { answer: 'hello' });
        expect(engine.getState().responses.q1).toEqual({ answer: 'hello' });
      });

      it('replaces an existing response', () => {
        engine.getState().setResponse('q1', { answer: 'first' });
        engine.getState().setResponse('q1', { answer: 'second' });
        expect(engine.getState().responses.q1).toEqual({ answer: 'second' });
      });

      it('does not clobber other responses', () => {
        engine.getState().setResponse('q1', { answer: 'a' });
        engine.getState().setResponse('q2', { answer: 'b' });
        expect(engine.getState().responses.q1).toEqual({ answer: 'a' });
        expect(engine.getState().responses.q2).toEqual({ answer: 'b' });
      });
    });

    describe('clearResponse', () => {
      it('removes a field response', () => {
        engine.getState().setResponse('q1', { answer: 'hello' });
        engine.getState().clearResponse('q1');
        expect(engine.getState().responses.q1).toBeUndefined();
      });

      it('is safe for non-existent fieldId', () => {
        engine.getState().clearResponse('nonexistent');
        expect(engine.getState().responses).toEqual({});
      });
    });

    describe('resetResponses', () => {
      it('clears all responses', () => {
        engine.getState().setResponse('q1', { answer: 'a' });
        engine.getState().setResponse('q2', { answer: 'b' });
        engine.getState().resetResponses();
        expect(engine.getState().responses).toEqual({});
      });
    });
  });

  // -----------------------------------------------------------------------
  // Builder Actions
  // -----------------------------------------------------------------------

  describe('builder actions', () => {
    describe('addField', () => {
      it('adds a field at root level', () => {
        engine = createFormEngine(form([]));
        const id = engine.getState().addField('text');
        expect(id).toBeTruthy();
        const s = engine.getState();
        expect(s.normalized.rootIds).toEqual([id]);
        expect(s.normalized.byId[id!].definition.fieldType).toBe('text');
        expect(s.normalized.byId[id!].parentId).toBeNull();
      });

      it('inserts at specific root index', () => {
        engine = createFormEngine(form([field('a'), field('b')]));
        const id = engine.getState().addField('text', { index: 1 });
        expect(engine.getState().normalized.rootIds).toEqual(['a', id, 'b']);
      });

      it('adds a field inside a section', () => {
        engine = createFormEngine(form([field('s1', 'section')]));
        const id = engine.getState().addField('text', { parentId: 's1' });
        expect(id).toBeTruthy();
        const s = engine.getState();
        expect(s.normalized.byId['s1'].childIds).toContain(id);
        expect(s.normalized.byId[id!].parentId).toBe('s1');
        expect(s.normalized.rootIds).not.toContain(id);
      });

      it('applies initial patch', () => {
        engine = createFormEngine(form([]));
        const id = engine.getState().addField('text', {
          patch: { question: 'Hello' },
        });
        expect(engine.getState().normalized.byId[id!].definition.question).toBe(
          'Hello'
        );
      });

      it('returns null for unknown field type', () => {
        engine = createFormEngine(form([]));
        expect(engine.getState().addField('nope' as FieldType)).toBeNull();
      });

      it('returns null for nonexistent parent', () => {
        engine = createFormEngine(form([]));
        expect(
          engine.getState().addField('text', { parentId: 'missing' })
        ).toBeNull();
      });

      it('auto-generates options for choice fields', () => {
        engine = createFormEngine(form([]));
        const id = engine.getState().addField('radio');
        const def = engine.getState().normalized.byId[id!].definition;
        expect(def.options!.length).toBeGreaterThan(0);
        expect(def.options![0].id).toBeTruthy();
      });

      it('auto-generates rows and columns for matrix fields', () => {
        engine = createFormEngine(form([]));
        const id = engine.getState().addField('singlematrix');
        const def = engine.getState().normalized.byId[id!].definition;
        expect(def.rows!.length).toBeGreaterThan(0);
        expect(def.columns!.length).toBeGreaterThan(0);
      });

      it('assigns correct indices to siblings', () => {
        engine = createFormEngine(form([field('a')]));
        const id = engine.getState().addField('text');
        expect(engine.getState().normalized.byId['a'].index).toBe(0);
        expect(engine.getState().normalized.byId[id!].index).toBe(1);
      });
    });

    describe('updateField', () => {
      beforeEach(() => {
        engine = createFormEngine(
          form([field('q1', 'text', { question: 'Old' })])
        );
      });

      it('patches field definition', () => {
        expect(engine.getState().updateField('q1', { question: 'New' })).toBe(
          true
        );
        expect(
          engine.getState().normalized.byId['q1'].definition.question
        ).toBe('New');
      });

      it('renames field ID', () => {
        expect(engine.getState().updateField('q1', { id: 'q1-renamed' })).toBe(
          true
        );
        const s = engine.getState();
        expect(s.normalized.byId['q1']).toBeUndefined();
        expect(s.normalized.byId['q1-renamed']).toBeDefined();
        expect(s.normalized.rootIds).toContain('q1-renamed');
        expect(s.normalized.rootIds).not.toContain('q1');
      });

      it('rejects rename on collision', () => {
        engine = createFormEngine(form([field('q1'), field('q2')]));
        expect(engine.getState().updateField('q1', { id: 'q2' })).toBe(false);
      });

      it('returns false for unknown field', () => {
        expect(engine.getState().updateField('nope', { question: 'X' })).toBe(
          false
        );
      });

      it('updates children parentId on section rename', () => {
        engine = createFormEngine(
          form([
            field('s1', 'section', {
              fields: [field('c1'), field('c2')],
            } as Partial<FieldDefinition>),
          ])
        );
        engine.getState().updateField('s1', { id: 's1-new' });
        const s = engine.getState();
        expect(s.normalized.byId['c1'].parentId).toBe('s1-new');
        expect(s.normalized.byId['c2'].parentId).toBe('s1-new');
      });

      it('preserves other fields untouched (same reference)', () => {
        engine = createFormEngine(
          form([field('q1'), field('q2', 'text', { question: 'Keep' })])
        );
        const before = engine.getState().normalized.byId['q2'];
        engine.getState().updateField('q1', { question: 'Changed' });
        expect(engine.getState().normalized.byId['q2']).toBe(before);
      });
    });

    describe('removeField', () => {
      it('removes a root field', () => {
        engine = createFormEngine(form([field('q1'), field('q2')]));
        expect(engine.getState().removeField('q1')).toBe(true);
        const s = engine.getState();
        expect(s.normalized.rootIds).toEqual(['q2']);
        expect(s.normalized.byId['q1']).toBeUndefined();
      });

      it('removes a section and all its children', () => {
        engine = createFormEngine(
          form([
            field('s1', 'section', {
              fields: [field('c1'), field('c2')],
            } as Partial<FieldDefinition>),
          ])
        );
        engine.getState().removeField('s1');
        const s = engine.getState();
        expect(s.normalized.byId['s1']).toBeUndefined();
        expect(s.normalized.byId['c1']).toBeUndefined();
        expect(s.normalized.byId['c2']).toBeUndefined();
      });

      it('removes a section child', () => {
        engine = createFormEngine(
          form([
            field('s1', 'section', {
              fields: [field('c1'), field('c2')],
            } as Partial<FieldDefinition>),
          ])
        );
        engine.getState().removeField('c1');
        const s = engine.getState();
        expect(s.normalized.byId['c1']).toBeUndefined();
        expect(s.normalized.byId['s1'].childIds).toEqual(['c2']);
      });

      it('returns false for unknown field', () => {
        engine = createFormEngine(form([]));
        expect(engine.getState().removeField('nope')).toBe(false);
      });

      it('reindexes siblings after removal', () => {
        engine = createFormEngine(form([field('a'), field('b'), field('c')]));
        engine.getState().removeField('a');
        expect(engine.getState().normalized.byId['b'].index).toBe(0);
        expect(engine.getState().normalized.byId['c'].index).toBe(1);
      });
    });

    describe('moveField', () => {
      it('reorders within root', () => {
        engine = createFormEngine(form([field('a'), field('b'), field('c')]));
        engine.getState().moveField('a', 2);
        expect(engine.getState().normalized.rootIds).toEqual(['b', 'c', 'a']);
      });

      it('moves field into a section', () => {
        engine = createFormEngine(form([field('s1', 'section'), field('q1')]));
        engine.getState().moveField('q1', 0, 's1');
        const s = engine.getState();
        expect(s.normalized.rootIds).toEqual(['s1']);
        expect(s.normalized.byId['s1'].childIds).toEqual(['q1']);
        expect(s.normalized.byId['q1'].parentId).toBe('s1');
      });

      it('moves field out of a section to root', () => {
        engine = createFormEngine(
          form([
            field('s1', 'section', {
              fields: [field('c1')],
            } as Partial<FieldDefinition>),
          ])
        );
        engine.getState().moveField('c1', 0, null);
        const s = engine.getState();
        expect(s.normalized.rootIds).toContain('c1');
        expect(s.normalized.byId['s1'].childIds).toEqual([]);
        expect(s.normalized.byId['c1'].parentId).toBeNull();
      });

      it('rejects move into own descendant', () => {
        engine = createFormEngine(
          form([
            field('s1', 'section', {
              fields: [field('c1')],
            } as Partial<FieldDefinition>),
          ])
        );
        expect(engine.getState().moveField('s1', 0, 'c1')).toBe(false);
      });

      it('returns false for unknown field', () => {
        engine = createFormEngine(form([]));
        expect(engine.getState().moveField('nope', 0)).toBe(false);
      });
    });

    describe('option CRUD', () => {
      it('addOption appends an option', () => {
        engine = createFormEngine(form([field('q1', 'text')]));
        const id = engine.getState().addOption('q1', 'Yes');
        expect(id).toBeTruthy();
        const opts = engine.getState().normalized.byId['q1'].definition.options;
        expect(opts).toEqual([{ id, value: 'Yes' }]);
      });

      it('updateOption changes an option value', () => {
        engine = createFormEngine(form([field('q1', 'text')]));
        const id = engine.getState().addOption('q1', 'Old');
        expect(engine.getState().updateOption('q1', id!, 'New')).toBe(true);
        const opts = engine.getState().normalized.byId['q1'].definition.options;
        expect(opts![0].value).toBe('New');
      });

      it('removeOption deletes an option', () => {
        engine = createFormEngine(form([field('q1', 'text')]));
        const id = engine.getState().addOption('q1', 'X');
        expect(engine.getState().removeOption('q1', id!)).toBe(true);
        const opts =
          engine.getState().normalized.byId['q1'].definition.options ?? [];
        expect(opts).toEqual([]);
      });

      it('returns null/false for nonexistent field', () => {
        engine = createFormEngine(form([]));
        expect(engine.getState().addOption('nope')).toBeNull();
        expect(engine.getState().updateOption('nope', 'x', 'y')).toBe(false);
        expect(engine.getState().removeOption('nope', 'x')).toBe(false);
      });
    });

    describe('row CRUD', () => {
      it('addRow, updateRow, removeRow', () => {
        engine = createFormEngine(form([field('m1', 'singlematrix')]));
        const rowId = engine.getState().addRow('m1', 'Row 1');
        expect(rowId).toBeTruthy();
        expect(engine.getState().normalized.byId['m1'].definition.rows).toEqual(
          [{ id: rowId, value: 'Row 1' }]
        );

        engine.getState().updateRow('m1', rowId!, 'Updated');
        expect(
          engine.getState().normalized.byId['m1'].definition.rows![0].value
        ).toBe('Updated');

        engine.getState().removeRow('m1', rowId!);
        expect(engine.getState().normalized.byId['m1'].definition.rows).toEqual(
          []
        );
      });
    });

    describe('column CRUD', () => {
      it('addColumn, updateColumn, removeColumn', () => {
        engine = createFormEngine(form([field('m1', 'singlematrix')]));
        const colId = engine.getState().addColumn('m1', 'Col 1');
        expect(colId).toBeTruthy();
        expect(
          engine.getState().normalized.byId['m1'].definition.columns
        ).toEqual([{ id: colId, value: 'Col 1' }]);

        engine.getState().updateColumn('m1', colId!, 'Updated');
        expect(
          engine.getState().normalized.byId['m1'].definition.columns![0].value
        ).toBe('Updated');

        engine.getState().removeColumn('m1', colId!);
        expect(
          engine.getState().normalized.byId['m1'].definition.columns
        ).toEqual([]);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Selectors
  // -----------------------------------------------------------------------

  describe('selectors', () => {
    beforeEach(() => {
      engine = createFormEngine(
        form([
          field('trigger'),
          field('q1', 'text', {
            required: true,
            rules: [visibleRule('trigger', 'show')],
          }),
          field('q2', 'text', {
            rules: [enableRule('trigger', 'yes')],
          }),
          field('q3', 'text', {
            rules: [requiredRule('trigger', 'yes')],
          }),
        ])
      );
    });

    describe('getField', () => {
      it('returns a field node', () => {
        const node = engine.getState().getField('q1');
        expect(node).toBeDefined();
        expect(node!.definition.id).toBe('q1');
      });

      it('returns undefined for unknown id', () => {
        expect(engine.getState().getField('unknown')).toBeUndefined();
      });
    });

    describe('getResponse', () => {
      it('returns undefined when no response set', () => {
        expect(engine.getState().getResponse('q1')).toBeUndefined();
      });

      it('returns the response after set', () => {
        engine.getState().setResponse('q1', { answer: 'hello' });
        expect(engine.getState().getResponse('q1')).toEqual({
          answer: 'hello',
        });
      });
    });

    describe('isVisible', () => {
      it('returns false when visibility rule fails', () => {
        engine.getState().setResponse('trigger', { answer: 'hide' });
        expect(engine.getState().isVisible('q1')).toBe(false);
      });

      it('returns true when visibility rule passes', () => {
        engine.getState().setResponse('trigger', { answer: 'show' });
        expect(engine.getState().isVisible('q1')).toBe(true);
      });

      it('returns false for unknown field', () => {
        expect(engine.getState().isVisible('unknown')).toBe(false);
      });
    });

    describe('isEnabled', () => {
      it('returns false when enable rule fails', () => {
        engine.getState().setResponse('trigger', { answer: 'no' });
        expect(engine.getState().isEnabled('q2')).toBe(false);
      });

      it('returns true when enable rule passes', () => {
        engine.getState().setResponse('trigger', { answer: 'yes' });
        expect(engine.getState().isEnabled('q2')).toBe(true);
      });
    });

    describe('isRequired', () => {
      it('returns false when required rule fails', () => {
        engine.getState().setResponse('trigger', { answer: 'no' });
        expect(engine.getState().isRequired('q3')).toBe(false);
      });

      it('returns true when required rule passes', () => {
        engine.getState().setResponse('trigger', { answer: 'yes' });
        expect(engine.getState().isRequired('q3')).toBe(true);
      });

      it('returns true for static required field', () => {
        // q1 has required: true
        expect(engine.getState().isRequired('q1')).toBe(true);
      });
    });

    describe('getFieldErrors', () => {
      it('returns errors for a required visible field without response', () => {
        engine.getState().setResponse('trigger', { answer: 'show' });
        const errors = engine.getState().getFieldErrors('q1');
        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe('required');
      });

      it('returns no errors when field is hidden', () => {
        engine.getState().setResponse('trigger', { answer: 'hide' });
        expect(engine.getState().getFieldErrors('q1')).toEqual([]);
      });

      it('returns no errors when field is answered', () => {
        engine.getState().setResponse('trigger', { answer: 'show' });
        engine.getState().setResponse('q1', { answer: 'hello' });
        expect(engine.getState().getFieldErrors('q1')).toEqual([]);
      });
    });

    describe('getErrors', () => {
      it('returns all errors across the form', () => {
        // trigger=show → q1 visible + required, trigger=yes → q3 required
        engine.getState().setResponse('trigger', { answer: 'show' });
        const errors = engine.getState().getErrors();
        // q1 is visible+required with no answer → error
        // q3 required rule expects 'yes', trigger is 'show' → not required → no error
        expect(errors.map((e) => e.fieldId)).toEqual(['q1']);
      });

      it('returns empty when all required fields are answered', () => {
        engine.getState().setResponse('trigger', { answer: 'show' });
        engine.getState().setResponse('q1', { answer: 'hello' });
        expect(engine.getState().getErrors()).toEqual([]);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on state change', () => {
      engine = createFormEngine(form([field('q1')]));
      const calls: unknown[] = [];
      engine.subscribe((state) => calls.push(state.responses));

      engine.getState().setResponse('q1', { answer: 'hi' });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ q1: { answer: 'hi' } });
    });
  });

  // -----------------------------------------------------------------------
  // hydrateDefinition
  // -----------------------------------------------------------------------

  describe('hydrateDefinition', () => {
    it('reconstructs a flat field list', () => {
      engine = createFormEngine(
        form([field('q1', 'text'), field('q2', 'number')])
      );
      const def = engine.getState().hydrateDefinition();
      expect(def.schemaType).toBe(SCHEMA_TYPE);
      expect(def.fields).toHaveLength(2);
      expect(def.fields[0].id).toBe('q1');
      expect(def.fields[1].id).toBe('q2');
    });

    it('reconstructs nested sections', () => {
      const sec = field('s1', 'section', {
        fields: [field('c1', 'text'), field('c2', 'number')],
      } as Partial<FieldDefinition>);
      engine = createFormEngine(form([sec, field('q1')]));
      const def = engine.getState().hydrateDefinition();
      expect(def.fields).toHaveLength(2);
      expect(def.fields[0].id).toBe('s1');
      expect(def.fields[0].fields).toHaveLength(2);
      expect(def.fields[0].fields![0].id).toBe('c1');
      expect(def.fields[0].fields![1].id).toBe('c2');
      expect(def.fields[1].id).toBe('q1');
    });

    it('returns empty fields when no definition loaded', () => {
      engine = createFormEngine();
      const def = engine.getState().hydrateDefinition();
      expect(def.fields).toEqual([]);
    });
  });
});
