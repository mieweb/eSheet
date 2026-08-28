import { describe, expect, it } from 'vitest';
import { createFormStore } from '@esheet/core';
import type { FieldResponse } from '@esheet/core';
import { bindDraftAnswers } from './draftBinding.js';
import type { DocumentDraft } from './draftChannel.js';

/** In-memory DocumentDraft — the channel surface without any transport. */
function fakeDraft(options?: {
  isNew?: boolean;
  answers?: Record<string, unknown>;
}): DocumentDraft & { emit: () => void } {
  const answers = new Map(Object.entries(options?.answers ?? {}));
  const listeners = new Set<(a: Readonly<Record<string, unknown>>) => void>();
  const snapshot = (): Record<string, unknown> => Object.fromEntries(answers);
  const emit = (): void => {
    for (const listener of listeners) listener(snapshot());
  };
  return {
    isNew: options?.isNew ?? false,
    body: { room: 'draft/case-1:doc-1' },
    meta: {
      openedBy: { id: 'u-1', name: 'One' },
      openedAt: '2026-08-23',
      baseRev: 0,
    },
    getAnswers: snapshot,
    setAnswer: (fieldId, value) => {
      if (value === undefined) answers.delete(fieldId);
      else answers.set(fieldId, value);
      emit(); // the real channel notifies local writes too
    },
    onAnswers: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onPresence: () => () => {},
    onDiscarded: () => () => {},
    publishFocus: () => {},
    discard: async () => {},
    close: () => {},
    emit,
  };
}

const response = (answer: string): FieldResponse => ({ answer });

describe('bindDraftAnswers (ED.37)', () => {
  it('an existing draft wins over the freshly loaded form', () => {
    const store = createFormStore();
    store.getState().setResponse('subject', response('stale local'));
    const draft = fakeDraft({ answers: { subject: response('shared truth') } });

    const unbind = bindDraftAnswers(store, draft);
    expect(store.getState().responses.subject).toEqual(
      response('shared truth')
    );
    unbind();
  });

  it('a brand-new empty draft is seeded from the form prefill', () => {
    const store = createFormStore();
    store.getState().setResponse('subject', response('prefilled'));
    const draft = fakeDraft({ isNew: true });

    const unbind = bindDraftAnswers(store, draft);
    expect(draft.getAnswers()).toEqual({ subject: response('prefilled') });
    expect(store.getState().responses.subject).toEqual(response('prefilled'));
    unbind();
  });

  it('store edits propagate to the draft, removals included', () => {
    const store = createFormStore();
    const draft = fakeDraft();
    const unbind = bindDraftAnswers(store, draft);

    store.getState().setResponse('subject', response('typed'));
    expect(draft.getAnswers()).toEqual({ subject: response('typed') });

    store.getState().clearResponse('subject');
    expect(draft.getAnswers()).toEqual({});
    unbind();
  });

  it('remote draft changes land in the store without echoing back', () => {
    const store = createFormStore();
    const draft = fakeDraft();
    let writes = 0;
    const originalSet = draft.setAnswer.bind(draft);
    draft.setAnswer = (fieldId, value) => {
      writes += 1;
      originalSet(fieldId, value);
    };
    const unbind = bindDraftAnswers(store, draft);

    originalSet('subject', response('from peer'));
    expect(store.getState().responses.subject).toEqual(response('from peer'));
    // Applying the remote value must not write it back to the draft.
    expect(writes).toBe(0);
    unbind();
  });

  it('unbinding stops both directions', () => {
    const store = createFormStore();
    const draft = fakeDraft();
    const unbind = bindDraftAnswers(store, draft);
    unbind();

    store.getState().setResponse('subject', response('after'));
    expect(draft.getAnswers()).toEqual({});
    draft.setAnswer('other', response('peer'));
    expect(store.getState().responses.other).toBeUndefined();
  });
});
