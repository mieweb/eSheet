// ---------------------------------------------------------------------------
// Activity log — recordActivity / mergeActivity / store integration tests
// ---------------------------------------------------------------------------

import {
  ACTIVITY_RESPONSE_KEY,
  formatActivityValue,
  mergeActivity,
} from './activity.js';
import { createFormStore } from '../stores/form-store.js';
import type { ActivityEntry, FormDefinition } from '../types.js';

const activityForm: FormDefinition = {
  id: 'activity-form',
  pages: [
    {
      id: 'p1',
      fields: [
        { id: 'name', fieldType: 'text', question: 'Your name' },
        { id: 'log', fieldType: 'activity', question: 'Activity' },
      ],
    },
  ],
};

const getLog = (
  store: ReturnType<typeof createFormStore>
): ActivityEntry[] =>
  store.getState().responses[ACTIVITY_RESPONSE_KEY]?.activity ?? [];

describe('store activity logging', () => {
  it('appends an entry when a response changes', () => {
    const store = createFormStore();
    store.getState().loadDefinition(activityForm);
    store.getState().setIdentity({ name: 'Dr. Demo' });
    store.getState().setResponse('name', { answer: 'Ada' });

    const log = getLog(store);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      fieldId: 'name',
      question: 'Your name',
      author: 'Dr. Demo',
      to: 'Ada',
    });
    expect(log[0].from).toBeUndefined();
    expect(log[0].id).toMatch(/[0-9a-f-]{36}/);
  });

  it('debounces keystrokes: rapid same-field changes collapse into one entry', () => {
    const store = createFormStore();
    store.getState().loadDefinition(activityForm);
    store.getState().setResponse('name', { answer: 'A' });
    store.getState().setResponse('name', { answer: 'Ad' });
    store.getState().setResponse('name', { answer: 'Ada' });

    const log = getLog(store);
    expect(log).toHaveLength(1);
    expect(log[0].from).toBeUndefined(); // original from preserved
    expect(log[0].to).toBe('Ada');
  });

  it('separate fields produce separate entries with from/to', () => {
    const store = createFormStore();
    store.getState().loadDefinition(activityForm);
    store.getState().setResponse('name', { answer: 'Ada' });
    store.getState().setResponse('name', { answer: 'Grace' });

    // same field within debounce → still 1 entry, but now change a different path
    expect(getLog(store)).toHaveLength(1);

    const withSecondField: FormDefinition = {
      ...activityForm,
      pages: [
        {
          id: 'p1',
          fields: [
            { id: 'a', fieldType: 'text', question: 'A' },
            { id: 'b', fieldType: 'text', question: 'B' },
            { id: 'log', fieldType: 'activity' },
          ],
        },
      ],
    };
    const store2 = createFormStore();
    store2.getState().loadDefinition(withSecondField);
    store2.getState().setResponse('a', { answer: 'one' });
    store2.getState().setResponse('b', { answer: 'two' });
    const log2 = getLog(store2);
    expect(log2).toHaveLength(2);
    expect(log2.map((e) => e.fieldId)).toEqual(['a', 'b']);
  });

  it('does not log when the form has no activity field', () => {
    const store = createFormStore();
    store.getState().loadDefinition({
      id: 'plain',
      pages: [{ id: 'p1', fields: [{ id: 'name', fieldType: 'text' }] }],
    });
    store.getState().setResponse('name', { answer: 'Ada' });
    expect(store.getState().responses[ACTIVITY_RESPONSE_KEY]).toBeUndefined();
  });

  it('does not log unchanged display values', () => {
    const store = createFormStore();
    store.getState().loadDefinition(activityForm);
    store.getState().setResponse('name', { answer: 'Ada' });
    const before = getLog(store);
    store.getState().setResponse('name', { answer: 'Ada' });
    expect(getLog(store)).toEqual(before);
  });
});

describe('mergeActivity', () => {
  const entry = (id: string, at: string): ActivityEntry => ({
    id,
    at,
    fieldId: 'f',
    to: id,
  });

  it('unions concurrent logs and sorts by at', () => {
    const merged = mergeActivity(
      [entry('x', '2026-01-02T00:00:00Z')],
      [entry('y', '2026-01-01T00:00:00Z')]
    );
    expect(merged.map((e) => e.id)).toEqual(['y', 'x']);
  });

  it('deduplicates same-id entries', () => {
    const a = entry('x', '2026-01-01T00:00:00Z');
    expect(mergeActivity([a], [a])).toHaveLength(1);
  });
});

describe('formatActivityValue', () => {
  it('formats scalars, selections, and entry arrays', () => {
    expect(formatActivityValue(undefined)).toBeUndefined();
    expect(formatActivityValue('')).toBeUndefined();
    expect(formatActivityValue('text')).toBe('text');
    expect(formatActivityValue(0)).toBe('0');
    expect(formatActivityValue({ id: 'opt1', value: 'Yes' })).toBe('Yes');
    expect(
      formatActivityValue([
        { id: 'a', value: 'One' },
        { id: 'b', value: 'Two' },
      ])
    ).toBe('One, Two');
    expect(
      formatActivityValue([
        { id: 'n1', createdAt: 'x', markdown: 'hi' },
        { id: 'n2', createdAt: 'y', markdown: 'ho' },
      ])
    ).toBe('2 entries');
  });
});
