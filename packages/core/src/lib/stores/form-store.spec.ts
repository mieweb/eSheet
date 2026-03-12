import { describe, it, expect, beforeEach } from 'vitest';
import { createFormStore } from './form-store.js';
import type { FormStore } from './form-store.js';
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
  fieldType = 'text',
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

describe('createFormStore', () => {
  let store: FormStore;

  // -----------------------------------------------------------------------
  // Factory
  // -----------------------------------------------------------------------

  describe('factory', () => {
    it('creates store with no initial definition', () => {
      store = createFormStore();
      const s = store.getState();
      expect(s.normalized.byId).toEqual({});
      expect(s.normalized.rootIds).toEqual([]);
      expect(s.responses).toEqual({});
    });

    it('creates store with initial definition', () => {
      const def = form([field('q1'), field('q2')]);
      store = createFormStore(def);
      const s = store.getState();
      expect(s.normalized.rootIds).toEqual(['q1', 'q2']);
      expect(s.responses).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  describe('actions', () => {
    beforeEach(() => {
      store = createFormStore(form([field('q1'), field('q2')]));
    });

    describe('loadDefinition', () => {
      it('replaces normalized index on load', () => {
        const newDef = form([field('a'), field('b'), field('c')]);
        store.getState().loadDefinition(newDef);
        const s = store.getState();
        expect(s.normalized.rootIds).toEqual(['a', 'b', 'c']);
      });

      it('clears responses on load', () => {
        store.getState().setResponse('q1', { answer: 'hello' });
        store.getState().loadDefinition(form([field('q1')]));
        expect(store.getState().responses).toEqual({});
      });
    });

    describe('setResponse', () => {
      it('sets a field response', () => {
        store.getState().setResponse('q1', { answer: 'hello' });
        expect(store.getState().responses.q1).toEqual({ answer: 'hello' });
      });

      it('replaces an existing response', () => {
        store.getState().setResponse('q1', { answer: 'first' });
        store.getState().setResponse('q1', { answer: 'second' });
        expect(store.getState().responses.q1).toEqual({ answer: 'second' });
      });

      it('does not clobber other responses', () => {
        store.getState().setResponse('q1', { answer: 'a' });
        store.getState().setResponse('q2', { answer: 'b' });
        expect(store.getState().responses.q1).toEqual({ answer: 'a' });
        expect(store.getState().responses.q2).toEqual({ answer: 'b' });
      });
    });

    describe('clearResponse', () => {
      it('removes a field response', () => {
        store.getState().setResponse('q1', { answer: 'hello' });
        store.getState().clearResponse('q1');
        expect(store.getState().responses.q1).toBeUndefined();
      });

      it('is safe for non-existent fieldId', () => {
        store.getState().clearResponse('nonexistent');
        expect(store.getState().responses).toEqual({});
      });
    });

    describe('resetResponses', () => {
      it('clears all responses', () => {
        store.getState().setResponse('q1', { answer: 'a' });
        store.getState().setResponse('q2', { answer: 'b' });
        store.getState().resetResponses();
        expect(store.getState().responses).toEqual({});
      });
    });
  });

  // -----------------------------------------------------------------------
  // Builder Actions
  // -----------------------------------------------------------------------

  describe('builder actions', () => {
    describe('addField', () => {
      it('adds a field at root level', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('text');
        expect(id).toBeTruthy();
        const s = store.getState();
        expect(s.normalized.rootIds).toEqual([id]);
        expect(s.normalized.byId[id!].definition.fieldType).toBe('text');
        expect(s.normalized.byId[id!].parentId).toBeNull();
      });

      it('inserts at specific root index', () => {
        store = createFormStore(form([field('a'), field('b')]));
        const id = store.getState().addField('text', { index: 1 });
        expect(store.getState().normalized.rootIds).toEqual(['a', id, 'b']);
      });

      it('adds a field inside a section', () => {
        store = createFormStore(form([field('s1', 'section')]));
        const id = store.getState().addField('text', { parentId: 's1' });
        expect(id).toBeTruthy();
        const s = store.getState();
        expect(s.normalized.byId['s1'].childIds).toContain(id);
        expect(s.normalized.byId[id!].parentId).toBe('s1');
        expect(s.normalized.rootIds).not.toContain(id);
      });

      it('applies initial patch', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('text', {
          patch: { question: 'Hello' },
        });
        expect(store.getState().normalized.byId[id!].definition.question).toBe(
          'Hello'
        );
      });

      it('returns null for unknown field type', () => {
        store = createFormStore(form([]));
        expect(store.getState().addField('nope' as FieldType)).toBeNull();
      });

      it('returns null for nonexistent parent', () => {
        store = createFormStore(form([]));
        expect(
          store.getState().addField('text', { parentId: 'missing' })
        ).toBeNull();
      });

      it('auto-generates options for choice fields', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('radio');
        const def = store.getState().normalized.byId[id!].definition;
        expect(def.options!.length).toBeGreaterThan(0);
        expect(def.options![0].id).toBeTruthy();
      });

      it('prefills question and option values for choice fields', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('radio');
        const def = store.getState().normalized.byId[id!].definition;
        expect(def.question).toBe('Radio question');
        expect(def.options?.map((o) => o.value)).toEqual([
          'Option 1',
          'Option 2',
          'Option 3',
        ]);
      });

      it('uses type-specific option defaults for boolean fields', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('boolean');
        const def = store.getState().normalized.byId[id!].definition;
        expect(def.options?.slice(0, 2).map((o) => o.value)).toEqual([
          'Yes',
          'No',
        ]);
      });

      it('keeps caller patch values over generated defaults', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('radio', {
          patch: {
            question: 'Preferred color?',
            options: [
              { id: 'manual-1', value: 'Red' },
              { id: 'manual-2', value: 'Blue' },
            ],
          },
        });
        const def = store.getState().normalized.byId[id!].definition;
        expect(def.question).toBe('Preferred color?');
        expect(def.options?.map((o) => o.value)).toEqual(['Red', 'Blue']);
      });

      it('auto-generates rows and columns for matrix fields', () => {
        store = createFormStore(form([]));
        const id = store.getState().addField('singlematrix');
        const def = store.getState().normalized.byId[id!].definition;
        expect(def.rows!.length).toBeGreaterThan(0);
        expect(def.columns!.length).toBeGreaterThan(0);
      });

      it('assigns correct indices to siblings', () => {
        store = createFormStore(form([field('a')]));
        const id = store.getState().addField('text');
        expect(store.getState().normalized.byId['a'].index).toBe(0);
        expect(store.getState().normalized.byId[id!].index).toBe(1);
      });
    });

    describe('updateField', () => {
      beforeEach(() => {
        store = createFormStore(
          form([field('q1', 'text', { question: 'Old' })])
        );
      });

      it('patches field definition', () => {
        expect(store.getState().updateField('q1', { question: 'New' })).toBe(
          true
        );
        expect(store.getState().normalized.byId['q1'].definition.question).toBe(
          'New'
        );
      });

      it('renames field ID', () => {
        expect(store.getState().updateField('q1', { id: 'q1-renamed' })).toBe(
          true
        );
        const s = store.getState();
        expect(s.normalized.byId['q1']).toBeUndefined();
        expect(s.normalized.byId['q1-renamed']).toBeDefined();
        expect(s.normalized.rootIds).toContain('q1-renamed');
        expect(s.normalized.rootIds).not.toContain('q1');
      });

      it('rejects rename on collision', () => {
        store = createFormStore(form([field('q1'), field('q2')]));
        expect(store.getState().updateField('q1', { id: 'q2' })).toBe(false);
      });

      it('returns false for unknown field', () => {
        expect(store.getState().updateField('nope', { question: 'X' })).toBe(
          false
        );
      });

      it('updates children parentId on section rename', () => {
        store = createFormStore(
          form([
            field('s1', 'section', {
              fields: [field('c1'), field('c2')],
            } as Partial<FieldDefinition>),
          ])
        );
        store.getState().updateField('s1', { id: 's1-new' });
        const s = store.getState();
        expect(s.normalized.byId['c1'].parentId).toBe('s1-new');
        expect(s.normalized.byId['c2'].parentId).toBe('s1-new');
      });

      it('preserves other fields untouched (same reference)', () => {
        store = createFormStore(
          form([field('q1'), field('q2', 'text', { question: 'Keep' })])
        );
        const before = store.getState().normalized.byId['q2'];
        store.getState().updateField('q1', { question: 'Changed' });
        expect(store.getState().normalized.byId['q2']).toBe(before);
      });
    });

    describe('removeField', () => {
      it('removes a root field', () => {
        store = createFormStore(form([field('q1'), field('q2')]));
        expect(store.getState().removeField('q1')).toBe(true);
        const s = store.getState();
        expect(s.normalized.rootIds).toEqual(['q2']);
        expect(s.normalized.byId['q1']).toBeUndefined();
      });

      it('removes a section and all its children', () => {
        store = createFormStore(
          form([
            field('s1', 'section', {
              fields: [field('c1'), field('c2')],
            } as Partial<FieldDefinition>),
          ])
        );
        store.getState().removeField('s1');
        const s = store.getState();
        expect(s.normalized.byId['s1']).toBeUndefined();
        expect(s.normalized.byId['c1']).toBeUndefined();
        expect(s.normalized.byId['c2']).toBeUndefined();
      });

      it('removes a section child', () => {
        store = createFormStore(
          form([
            field('s1', 'section', {
              fields: [field('c1'), field('c2')],
            } as Partial<FieldDefinition>),
          ])
        );
        store.getState().removeField('c1');
        const s = store.getState();
        expect(s.normalized.byId['c1']).toBeUndefined();
        expect(s.normalized.byId['s1'].childIds).toEqual(['c2']);
      });

      it('returns false for unknown field', () => {
        store = createFormStore(form([]));
        expect(store.getState().removeField('nope')).toBe(false);
      });

      it('reindexes siblings after removal', () => {
        store = createFormStore(form([field('a'), field('b'), field('c')]));
        store.getState().removeField('a');
        expect(store.getState().normalized.byId['b'].index).toBe(0);
        expect(store.getState().normalized.byId['c'].index).toBe(1);
      });
    });

    describe('moveField', () => {
      it('reorders within root', () => {
        store = createFormStore(form([field('a'), field('b'), field('c')]));
        store.getState().moveField('a', 2);
        expect(store.getState().normalized.rootIds).toEqual(['b', 'c', 'a']);
      });

      it('moves field into a section', () => {
        store = createFormStore(form([field('s1', 'section'), field('q1')]));
        store.getState().moveField('q1', 0, 's1');
        const s = store.getState();
        expect(s.normalized.rootIds).toEqual(['s1']);
        expect(s.normalized.byId['s1'].childIds).toEqual(['q1']);
        expect(s.normalized.byId['q1'].parentId).toBe('s1');
      });

      it('moves field out of a section to root', () => {
        store = createFormStore(
          form([
            field('s1', 'section', {
              fields: [field('c1')],
            } as Partial<FieldDefinition>),
          ])
        );
        store.getState().moveField('c1', 0, null);
        const s = store.getState();
        expect(s.normalized.rootIds).toContain('c1');
        expect(s.normalized.byId['s1'].childIds).toEqual([]);
        expect(s.normalized.byId['c1'].parentId).toBeNull();
      });

      it('rejects move into own descendant', () => {
        store = createFormStore(
          form([
            field('s1', 'section', {
              fields: [field('c1')],
            } as Partial<FieldDefinition>),
          ])
        );
        expect(store.getState().moveField('s1', 0, 'c1')).toBe(false);
      });

      it('returns false for unknown field', () => {
        store = createFormStore(form([]));
        expect(store.getState().moveField('nope', 0)).toBe(false);
      });
    });

    describe('option CRUD', () => {
      it('addOption appends an option', () => {
        store = createFormStore(form([field('q1', 'text')]));
        const id = store.getState().addOption('q1', 'Yes');
        expect(id).toBeTruthy();
        const opts = store.getState().normalized.byId['q1'].definition.options;
        expect(opts).toEqual([{ id, value: 'Yes' }]);
      });

      it('updateOption changes an option value', () => {
        store = createFormStore(form([field('q1', 'text')]));
        const id = store.getState().addOption('q1', 'Old');
        expect(store.getState().updateOption('q1', id!, 'New')).toBe(true);
        const opts = store.getState().normalized.byId['q1'].definition.options;
        expect(opts![0].value).toBe('New');
      });

      it('removeOption deletes an option', () => {
        store = createFormStore(form([field('q1', 'text')]));
        const id = store.getState().addOption('q1', 'X');
        expect(store.getState().removeOption('q1', id!)).toBe(true);
        const opts =
          store.getState().normalized.byId['q1'].definition.options ?? [];
        expect(opts).toEqual([]);
      });

      it('returns null/false for nonexistent field', () => {
        store = createFormStore(form([]));
        expect(store.getState().addOption('nope')).toBeNull();
        expect(store.getState().updateOption('nope', 'x', 'y')).toBe(false);
        expect(store.getState().removeOption('nope', 'x')).toBe(false);
      });
    });

    describe('row CRUD', () => {
      it('addRow, updateRow, removeRow', () => {
        store = createFormStore(form([field('m1', 'singlematrix')]));
        const rowId = store.getState().addRow('m1', 'Row 1');
        expect(rowId).toBeTruthy();
        expect(store.getState().normalized.byId['m1'].definition.rows).toEqual([
          { id: rowId, value: 'Row 1' },
        ]);

        store.getState().updateRow('m1', rowId!, 'Updated');
        expect(
          store.getState().normalized.byId['m1'].definition.rows![0].value
        ).toBe('Updated');

        store.getState().removeRow('m1', rowId!);
        expect(store.getState().normalized.byId['m1'].definition.rows).toEqual(
          []
        );
      });
    });

    describe('column CRUD', () => {
      it('addColumn, updateColumn, removeColumn', () => {
        store = createFormStore(form([field('m1', 'singlematrix')]));
        const colId = store.getState().addColumn('m1', 'Col 1');
        expect(colId).toBeTruthy();
        expect(
          store.getState().normalized.byId['m1'].definition.columns
        ).toEqual([{ id: colId, value: 'Col 1' }]);

        store.getState().updateColumn('m1', colId!, 'Updated');
        expect(
          store.getState().normalized.byId['m1'].definition.columns![0].value
        ).toBe('Updated');

        store.getState().removeColumn('m1', colId!);
        expect(
          store.getState().normalized.byId['m1'].definition.columns
        ).toEqual([]);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Selectors
  // -----------------------------------------------------------------------

  describe('selectors', () => {
    beforeEach(() => {
      store = createFormStore(
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
        const node = store.getState().getField('q1');
        expect(node).toBeDefined();
        expect(node!.definition.id).toBe('q1');
      });

      it('returns undefined for unknown id', () => {
        expect(store.getState().getField('unknown')).toBeUndefined();
      });
    });

    describe('getResponse', () => {
      it('returns undefined when no response set', () => {
        expect(store.getState().getResponse('q1')).toBeUndefined();
      });

      it('returns the response after set', () => {
        store.getState().setResponse('q1', { answer: 'hello' });
        expect(store.getState().getResponse('q1')).toEqual({
          answer: 'hello',
        });
      });
    });

    describe('isVisible', () => {
      it('returns false when visibility rule fails', () => {
        store.getState().setResponse('trigger', { answer: 'hide' });
        expect(store.getState().isVisible('q1')).toBe(false);
      });

      it('returns true when visibility rule passes', () => {
        store.getState().setResponse('trigger', { answer: 'show' });
        expect(store.getState().isVisible('q1')).toBe(true);
      });

      it('returns false for unknown field', () => {
        expect(store.getState().isVisible('unknown')).toBe(false);
      });
    });

    describe('isEnabled', () => {
      it('returns false when enable rule fails', () => {
        store.getState().setResponse('trigger', { answer: 'no' });
        expect(store.getState().isEnabled('q2')).toBe(false);
      });

      it('returns true when enable rule passes', () => {
        store.getState().setResponse('trigger', { answer: 'yes' });
        expect(store.getState().isEnabled('q2')).toBe(true);
      });
    });

    describe('isRequired', () => {
      it('returns false when required rule fails', () => {
        store.getState().setResponse('trigger', { answer: 'no' });
        expect(store.getState().isRequired('q3')).toBe(false);
      });

      it('returns true when required rule passes', () => {
        store.getState().setResponse('trigger', { answer: 'yes' });
        expect(store.getState().isRequired('q3')).toBe(true);
      });

      it('returns true for static required field', () => {
        // q1 has required: true
        expect(store.getState().isRequired('q1')).toBe(true);
      });
    });

    describe('getFieldErrors', () => {
      it('returns errors for a required visible field without response', () => {
        store.getState().setResponse('trigger', { answer: 'show' });
        const errors = store.getState().getFieldErrors('q1');
        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe('required');
      });

      it('returns no errors when field is hidden', () => {
        store.getState().setResponse('trigger', { answer: 'hide' });
        expect(store.getState().getFieldErrors('q1')).toEqual([]);
      });

      it('returns no errors when field is answered', () => {
        store.getState().setResponse('trigger', { answer: 'show' });
        store.getState().setResponse('q1', { answer: 'hello' });
        expect(store.getState().getFieldErrors('q1')).toEqual([]);
      });
    });

    describe('getErrors', () => {
      it('returns all errors across the form', () => {
        // trigger=show → q1 visible + required, trigger=yes → q3 required
        store.getState().setResponse('trigger', { answer: 'show' });
        const errors = store.getState().getErrors();
        // q1 is visible+required with no answer → error
        // q3 required rule expects 'yes', trigger is 'show' → not required → no error
        expect(errors.map((e) => e.fieldId)).toEqual(['q1']);
      });

      it('returns empty when all required fields are answered', () => {
        store.getState().setResponse('trigger', { answer: 'show' });
        store.getState().setResponse('q1', { answer: 'hello' });
        expect(store.getState().getErrors()).toEqual([]);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on state change', () => {
      store = createFormStore(form([field('q1')]));
      const calls: unknown[] = [];
      store.subscribe((state) => calls.push(state.responses));

      store.getState().setResponse('q1', { answer: 'hi' });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ q1: { answer: 'hi' } });
    });
  });

  // -----------------------------------------------------------------------
  // hydrateDefinition
  // -----------------------------------------------------------------------

  describe('hydrateDefinition', () => {
    it('reconstructs a flat field list', () => {
      store = createFormStore(
        form([field('q1', 'text'), field('q2', 'number')])
      );
      const def = store.getState().hydrateDefinition();
      expect(def.schemaType).toBe(SCHEMA_TYPE);
      expect(def.fields).toHaveLength(2);
      expect(def.fields[0].id).toBe('q1');
      expect(def.fields[1].id).toBe('q2');
    });

    it('reconstructs nested sections', () => {
      const sec = field('s1', 'section', {
        fields: [field('c1', 'text'), field('c2', 'number')],
      } as Partial<FieldDefinition>);
      store = createFormStore(form([sec, field('q1')]));
      const def = store.getState().hydrateDefinition();
      expect(def.fields).toHaveLength(2);
      expect(def.fields[0].id).toBe('s1');
      expect(def.fields[0].fields).toHaveLength(2);
      expect(def.fields[0].fields![0].id).toBe('c1');
      expect(def.fields[0].fields![1].id).toBe('c2');
      expect(def.fields[1].id).toBe('q1');
    });

    it('returns empty fields when no definition loaded', () => {
      store = createFormStore();
      const def = store.getState().hydrateDefinition();
      expect(def.fields).toEqual([]);
    });
  });
});
