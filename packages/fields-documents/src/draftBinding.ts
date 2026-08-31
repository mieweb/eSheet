/**
 * ED.37 — two-way sync between an eSheet form store and a draft's answers.
 *
 * The eCase original (`responsesBinding.ts`) binds a store to a Y.Map; this
 * package must not import Yjs, so the same choreography runs against the
 * `DocumentDraft` answers surface instead: field responses are copied whole,
 * a single field is the unit of merge, and a feedback flag keeps our own
 * writes from echoing back (the channel notifies local writes too).
 *
 * Bind *after* the renderer's `onReady`: `loadDefinition` resets responses.
 */
import type { FieldResponse, FormStore } from '@esheet/core';
import type { DocumentDraft } from './draftChannel.js';

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function bindDraftAnswers(
  store: FormStore,
  draft: DocumentDraft
): () => void {
  let applying = false;

  const applyToStore = (answers: Readonly<Record<string, unknown>>): void => {
    applying = true;
    try {
      const { responses, setResponse, clearResponse } = store.getState();
      for (const [fieldId, response] of Object.entries(answers)) {
        if (!same(responses[fieldId], response)) {
          setResponse(fieldId, response as FieldResponse);
        }
      }
      for (const fieldId of Object.keys(responses)) {
        if (!(fieldId in answers)) clearResponse(fieldId);
      }
    } finally {
      applying = false;
    }
  };

  const offAnswers = draft.onAnswers((answers) => {
    if (!applying) applyToStore(answers);
  });

  const unsubscribe = store.subscribe((state, previous) => {
    if (applying || state.responses === previous.responses) return;
    applying = true;
    try {
      const answers = draft.getAnswers();
      for (const [fieldId, response] of Object.entries(state.responses)) {
        if (!same(answers[fieldId], response))
          draft.setAnswer(fieldId, response);
      }
      for (const fieldId of Object.keys(answers)) {
        if (!(fieldId in state.responses)) draft.setAnswer(fieldId, undefined);
      }
    } finally {
      applying = false;
    }
  });

  // A brand-new, still-empty draft is seeded from the form (the prefill);
  // otherwise whatever the draft already holds wins — the form has just been
  // (re)loaded and the draft is the shared truth.
  const initial = draft.getAnswers();
  if (draft.isNew && Object.keys(initial).length === 0) {
    applying = true;
    try {
      for (const [fieldId, response] of Object.entries(
        store.getState().responses
      )) {
        draft.setAnswer(fieldId, response);
      }
    } finally {
      applying = false;
    }
  } else {
    applyToStore(initial);
  }

  return () => {
    offAnswers();
    unsubscribe();
  };
}
