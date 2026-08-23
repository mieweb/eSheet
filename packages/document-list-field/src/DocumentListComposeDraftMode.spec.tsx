import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DocumentListComposePanel } from './DocumentListWorkflows.js';
import type { DocumentDraft } from './draftChannel.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';

// The real editor would lazy-load the Yjs collab kit (an optional peer this
// workspace does not install); draft-mode wiring is what's under test, so the
// editor is a stub that records the collab room it was asked to join.
const editorProps: Record<string, unknown>[] = [];
vi.mock('@mieweb/ui/kerebron', () => ({
  RichEditor: (props: Record<string, unknown>) => {
    editorProps.push(props);
    return <textarea aria-label={String(props['aria-label'] ?? 'Note')} />;
  },
}));

function fakeDraft(options?: { isNew?: boolean }): DocumentDraft & {
  answers: Map<string, unknown>;
  emit: () => void;
  closed: () => number;
} {
  const answers = new Map<string, unknown>();
  const listeners = new Set<(a: Readonly<Record<string, unknown>>) => void>();
  let closed = 0;
  const snapshot = (): Record<string, unknown> => Object.fromEntries(answers);
  const emit = (): void => {
    for (const listener of listeners) listener(snapshot());
  };
  return {
    isNew: options?.isNew ?? true,
    body: { room: 'draft/case-1:doc-1', wsUrl: 'ws://relay/yorm/ws' },
    meta: { openedBy: { id: 'u-1', name: 'One' }, openedAt: '2026-08-23', baseRev: 0 },
    getAnswers: snapshot,
    setAnswer: (fieldId, value) => {
      if (value === undefined) answers.delete(fieldId);
      else answers.set(fieldId, value);
      emit();
    },
    onAnswers: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onPresence: () => () => {},
    discard: async () => {},
    close: () => {
      closed += 1;
    },
    answers,
    emit,
    closed: () => closed,
  };
}

const runtime = { saveDocument: vi.fn() } as unknown as DocumentListRuntimeState;

describe('compose panel in draft mode (ED.37)', () => {
  beforeEach(() => {
    editorProps.length = 0;
  });

  it('hands the editor the draft room instead of owning the content', async () => {
    const draft = fakeDraft({ isNew: false });
    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
        documentDraft={draft}
      />
    );
    await waitFor(() => expect(editorProps.length).toBeGreaterThan(0));
    const props = editorProps.at(-1)!;
    expect(props.collab).toEqual({
      room: 'draft/case-1:doc-1',
      wsUrl: 'ws://relay/yorm/ws',
      params: {},
    });
    // A joiner must not seed the shared body.
    expect(props.value).toBe('');
  });

  it('shares note-tier meta through the answers map, both directions', async () => {
    const draft = fakeDraft();
    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
        documentDraft={draft}
      />
    );

    fireEvent.change(await screen.findByLabelText(/^Title/), {
      target: { value: 'Shared title' },
    });
    expect(draft.answers.get('meta:title')).toBe('Shared title');

    // A peer's edit lands in the field.
    draft.answers.set('meta:subject', 'From the other browser');
    draft.emit();
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/^Subject/) as HTMLInputElement).value
      ).toBe('From the other browser')
    );
  });

  it('closing leaves the draft intact for the other author', async () => {
    const draft = fakeDraft();
    const onOpenChange = vi.fn();
    render(
      <DocumentListComposePanel
        open
        onOpenChange={onOpenChange}
        runtime={runtime}
        inputPrefix="form-1-documents"
        documentDraft={draft}
      />
    );

    fireEvent.change(await screen.findByLabelText(/^Title/), {
      target: { value: 'Half-written' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(draft.closed()).toBe(1);
    // Left, not discarded: the shared state survives the panel.
    expect(draft.answers.get('meta:title')).toBe('Half-written');
  });
});
