import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createFormStore, type FieldComponentProps } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import { DocumentListComposePanel } from './DocumentListWorkflows.js';
import { DocumentListField } from './DocumentListField.js';
import { DocumentListFieldProvider } from './DocumentListGrid.js';
import { permissiveDocumentListCapabilities } from './types.js';
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

const captured = { props: null as Record<string, unknown> | null };
vi.mock('@mieweb/ui/datavis', () => ({
  DataVisNitroContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
  DataVisNitroGrid: (props: Record<string, unknown>) => {
    captured.props = props;
    return (props.titleActions as ReactNode) ?? null;
  },
}));

vi.mock('datavis-ace', () => {
  class Source {
    cache: Record<string, unknown> = {};
    constructor(public readonly options: unknown) {}
  }
  class ComputedView {
    constructor(public readonly source: Source) {}
    clearCache(): void {}
    getData(): void {}
  }
  return { ComputedView, Source };
});

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
    meta: {
      openedBy: { id: 'u-1', name: 'One' },
      openedAt: '2026-08-23',
      baseRev: 0,
    },
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
    onDiscarded: () => () => {},
    publishFocus: () => {},
    discard: async () => {},
    close: () => {
      closed += 1;
    },
    answers,
    emit,
    closed: () => closed,
  };
}

const runtime = {
  saveDocument: vi.fn(),
} as unknown as DocumentListRuntimeState;

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

  // ED.39 — a save is a revision: same row, rev + 1, prior prose kept, draft
  // cleared for everyone.
  it('saving a draft projects the next head revision and discards the draft', async () => {
    const prior = {
      id: 'doc-1',
      date: '2026-08-14',
      title: 'Original note',
      subject: 'Original subject',
      docType: 'progress-note',
      docId: 'doc-1',
      source: 'Compose',
      file: 'doc-1.md',
      author: { id: 'u-riley', name: 'Riley Reviewer' },
      rev: 0,
      body: 'original prose',
    };
    const saveDocument = vi.fn(async (document: unknown) => document);
    const revisingRuntime = {
      documents: { 'doc-1': prior },
      saveDocument,
    } as unknown as DocumentListRuntimeState;
    const draft = fakeDraft({ isNew: false });
    const discard = vi.spyOn(draft, 'discard');
    const onOpenChange = vi.fn();

    render(
      <DocumentListComposePanel
        open
        onOpenChange={onOpenChange}
        runtime={revisingRuntime}
        inputPrefix="form-1-documents"
        author={{ id: 'u-casey', name: 'Casey Manager' }}
        documentDraft={draft}
        documentId="doc-1"
      />
    );

    fireEvent.change(await screen.findByLabelText(/^Title/), {
      target: { value: 'Revised note' },
    });
    fireEvent.change(screen.getByLabelText(/^Subject/), {
      target: { value: 'Revised subject' },
    });
    fireEvent.change(screen.getByLabelText(/^Document type/), {
      target: { value: 'progress-note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));

    await waitFor(() => expect(saveDocument).toHaveBeenCalledOnce());
    const [saved, content] = saveDocument.mock.calls[0] as [
      Record<string, unknown>,
      unknown
    ];
    expect(saved).toMatchObject({
      id: 'doc-1', // the row, not a new one
      title: 'Revised note',
      rev: 1,
      author: { id: 'u-casey', name: 'Casey Manager' }, // the saver owns it
      history: [
        {
          rev: 0,
          action: 'create',
          author: { id: 'u-riley', name: 'Riley Reviewer' },
          body: 'original prose',
        },
      ],
    });
    // Inline tier: the prose stays on the row, nothing goes to a repository.
    expect(content).toBeUndefined();
    expect(discard).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ED.40 — Edit on a row opens (or joins) its draft, prefilled from the last
  // saved revision, and the panel says it is revising.
  it('the Edit action opens the draft prefilled from the head revision', async () => {
    const row = {
      id: 'doc-1',
      date: '2026-08-14',
      title: 'Existing note',
      subject: 'Original subject',
      docType: 'progress-note',
      docId: 'doc-1',
      source: 'Compose',
      file: 'doc-1.md',
      rev: 0,
      body: 'original prose',
    };
    const draft = fakeDraft({ isNew: true });
    const open = vi.fn(async () => draft);
    const draftChannel = { open, presenceOf: vi.fn(() => () => {}) };
    const formStore = createFormStore();
    const fieldProps = {
      field: {
        definition: {
          id: 'documents',
          question: 'Documents',
          documents: [row],
        },
      },
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
            author: { id: 'u-casey', name: 'Casey Manager' },
            draftChannel,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());
    const gridProps = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    const actions = render(
      <>{gridProps.formatCell(undefined, { ...row }, { field: '_actions' })}</>
    );
    fireEvent.click(
      actions.getByRole('button', { name: 'Edit Existing note' })
    );

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('doc-1', {
        openedBy: { id: 'u-casey', name: 'Casey Manager' },
        baseRev: 0,
      })
    );
    // The panel opened on the row's draft, saying which act this is.
    expect(await screen.findByText('Revise document (rev 0)')).toBeTruthy();
    // The opener seeds the prefill: the head revision's body.
    await waitFor(() =>
      expect(editorProps.at(-1)).toMatchObject({ value: 'original prose' })
    );
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe(
      'Existing note'
    );
  });

  // ED.41 — one Append action, two shapes, the author picks.
  describe('append', () => {
    const prior = {
      id: 'doc-1',
      date: '2026-08-14',
      title: 'Original note',
      subject: 'Original subject',
      docType: 'progress-note',
      docId: 'doc-1',
      source: 'Compose',
      file: 'doc-1.md',
      author: { id: 'u-riley', name: 'Riley Reviewer' },
      rev: 1,
      action: 'edit',
      body: 'original prose',
    };

    async function submitAppend(shape: 'revision' | 'linked') {
      const saveDocument = vi.fn(async (document: unknown) => document);
      const appendRuntime = {
        documents: { 'doc-1': prior },
        saveDocument,
      } as unknown as DocumentListRuntimeState;
      const draft = fakeDraft({ isNew: false });

      render(
        <DocumentListComposePanel
          open
          onOpenChange={vi.fn()}
          runtime={appendRuntime}
          inputPrefix="form-1-documents"
          author={{ id: 'u-casey', name: 'Casey Manager' }}
          documentDraft={draft}
          documentId="doc-1"
          appendMode
        />
      );

      expect(
        await screen.findByText('Append to document (rev 1)')
      ).toBeTruthy();
      if (shape === 'linked') {
        fireEvent.click(
          screen.getByRole('radio', { name: /A linked document/ })
        );
      }
      fireEvent.change(screen.getByLabelText(/^Title/), {
        target: { value: 'Addendum title' },
      });
      fireEvent.change(screen.getByLabelText(/^Subject/), {
        target: { value: 'More information' },
      });
      fireEvent.change(screen.getByLabelText(/^Document type/), {
        target: { value: 'progress-note' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
      await waitFor(() => expect(saveDocument).toHaveBeenCalledOnce());
      return saveDocument.mock.calls[0][0] as Record<string, unknown>;
    }

    it('as a revision: the same document, rev + 1, action append', async () => {
      const saved = await submitAppend('revision');
      expect(saved).toMatchObject({
        id: 'doc-1',
        rev: 2,
        action: 'append',
        author: { id: 'u-casey', name: 'Casey Manager' },
      });
      // The superseded head keeps its own recorded action.
      expect((saved.history as { action: string }[]).at(-1)).toMatchObject({
        rev: 1,
        action: 'edit',
        body: 'original prose',
      });
    });

    it('as a linked document: a new row pointing back, original untouched', async () => {
      const saved = await submitAppend('linked');
      expect(saved.id).not.toBe('doc-1');
      expect(saved).toMatchObject({
        action: 'create',
        linkedTo: { id: 'doc-1', linkType: 'addendum' },
        author: { id: 'u-casey', name: 'Casey Manager' },
      });
      expect(saved.rev).toBeUndefined();
      expect(saved.history).toBeUndefined();
    });
  });

  // ED.42 — remove tombstones with a reason; restore is the same grant.
  it('remove asks for a reason, tombstones the row, and discards its draft', async () => {
    const row = {
      id: 'doc-1',
      date: '2026-08-14',
      title: 'Existing note',
      subject: '—',
      docType: 'progress-note',
      docId: 'doc-1',
      source: 'Compose',
      file: 'doc-1.md',
      rev: 1,
      action: 'edit',
      body: 'prose',
    };
    const draft = fakeDraft();
    const discard = vi.spyOn(draft, 'discard');
    const draftChannel = {
      open: vi.fn(async () => draft),
      presenceOf: vi.fn(() => () => {}),
    };
    const formStore = createFormStore();
    const fieldProps = {
      field: {
        definition: {
          id: 'documents',
          question: 'Documents',
          documents: [row],
        },
      },
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
            author: { id: 'u-morgan', name: 'Morgan Records' },
            draftChannel,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());
    const gridProps = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    const actions = render(
      <>{gridProps.formatCell(undefined, { ...row }, { field: '_actions' })}</>
    );
    fireEvent.click(
      actions.getByRole('button', { name: 'Remove Existing note' })
    );

    // The reason is required free text; the confirm stays disabled without it.
    const dialog = await screen.findByRole('dialog', { name: /Remove/ });
    expect(dialog).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Remove' });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText(/^Reason/), {
      target: { value: 'wrong patient' },
    });
    fireEvent.click(confirm);

    // The saved row is a tombstone: rev + 1, action remove, reasoned marker.
    const runtimeState = formStore
      .getState()
      .getExtension('@esheet/document-list-field', 'documents') as {
      documents: Record<string, Record<string, unknown>>;
    };
    await waitFor(() => {
      const saved = runtimeState.documents['doc-1'];
      expect(saved.removed).toMatchObject({
        reason: 'wrong patient',
        author: { id: 'u-morgan', name: 'Morgan Records' },
      });
      expect(saved).toMatchObject({ rev: 2, action: 'remove' });
    });
    // Removal is the stronger statement: the open draft was discarded.
    await waitFor(() => expect(discard).toHaveBeenCalled());

    // The grid hides the row; the affordance reveals it with Restore.
    expect(
      screen.getByRole('button', { name: 'Show removed (1)' })
    ).toBeTruthy();
  });

  // ED.33 — a type that names a template gets its body prefilled once, from
  // exactly the answers its mergeContext declares.
  it('prefills a new compose from the doc type template', async () => {
    const renderTemplate = vi.fn(async () => 'Dear Zoe,\n\nSincerely');
    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
        docTypes={[
          {
            id: 'acknowledgement',
            label: 'Acknowledgement',
            template: 'TEMPLATE SOURCE',
            mergeContext: { employeeName: 'subjectName' },
          },
        ]}
        renderTemplate={renderTemplate}
      />
    );

    await waitFor(() =>
      expect(renderTemplate).toHaveBeenCalledWith('TEMPLATE SOURCE', {
        employeeName: 'subjectName',
      })
    );
    // Note tier: the rendered body lands in the editor, once.
    await waitFor(() =>
      expect(editorProps.at(-1)).toMatchObject({
        value: 'Dear Zoe,\n\nSincerely',
      })
    );
    expect(renderTemplate).toHaveBeenCalledOnce();
  });
});
