import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState, useSyncExternalStore } from 'react';
import { createFormStore, type FileInput } from '@esheet/core';
import type {
  DocumentListContent,
  DocumentListRuntimeState,
  DocumentListSaveCategory,
} from './document-list-runtime.js';
import {
  createDocumentListRuntimeExtension,
  getDocumentListRuntimeState,
} from './document-list-runtime.js';
import {
  DocumentListComposePanel,
  DocumentListDetailRow,
  DocumentListUploadPanel,
  emptyComposeDraft,
} from './DocumentListWorkflows.js';
import type {
  DocumentListComposeDraft,
  DocumentListDocument,
  DocumentListWorkflowMode,
} from './types.js';

const pdfPreview = vi.hoisted(() => ({
  onReady: undefined as (() => void) | undefined,
}));

vi.mock('./DocumentListPdfPreview.js', () => ({
  DocumentListPdfViewer: ({
    reference,
    title,
    onReady,
  }: {
    readonly reference: string;
    readonly title: string;
    readonly onReady?: () => void;
  }) => {
    pdfPreview.onReady = onReady;
    return (
      <div aria-label={`PDF preview of ${title}`} data-reference={reference} />
    );
  },
}));

vi.mock('@esheet/field-kerebron', async () => {
  const React = await import('react');
  return {
    configureRichTextField: vi.fn(),
    KerebronEditor: React.forwardRef(
      (props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
        const value = props.value as string;
        const inputRef = React.useRef<HTMLTextAreaElement>(null);
        React.useImperativeHandle(ref, () => ({
          focus: () => inputRef.current?.focus(),
          getContent: async () => value,
        }));
        return (
          <div className={props.className as string}>
            <textarea
              ref={inputRef}
              aria-label={props.ariaLabel as string}
              disabled={props.disabled as boolean}
              value={value}
              onChange={(event) =>
                (props.onChange as (nextValue: string) => void)(
                  event.target.value
                )
              }
            />
          </div>
        );
      }
    ),
  };
});

vi.mock('@mieweb/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mieweb/ui')>();
  const Button = ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  );
  const Input = ({
    label,
    error,
    helperText,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    helperText?: string;
  }) => (
    <>
      <label>
        {label}
        <input {...props} />
        {error && <span>{error}</span>}
      </label>
      {helperText && <span>{helperText}</span>}
    </>
  );
  const Textarea = ({
    label,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
  }) => (
    <label>
      {label}
      <textarea {...props} />
    </label>
  );
  const Modal = ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div role="dialog">{children}</div> : null);
  const ModalHeader = ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  );
  const ModalTitle = ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  );
  const ModalClose = () => null;
  const ModalBody = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const ModalFooter = ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  );
  return {
    // The detail preview renders markdown with the real MarkdownRenderer.
    MarkdownRenderer: actual.MarkdownRenderer,
    Select: actual.Select,
    Button,
    Input,
    Modal,
    ModalBody,
    ModalClose,
    ModalFooter,
    ModalHeader,
    ModalTitle,
    Textarea,
  };
});

const document = {
  id: 'doc-1',
  date: '2026-08-18',
  title: 'Letter',
  subject: 'Subject',
  docType: 'Letter',
  docId: '42',
  source: 'WebChart',
  file: '42.pdf',
} as const;

function createRuntime(
  loadContent: DocumentListRuntimeState['loadContent'] = async () => undefined
): DocumentListRuntimeState {
  return {
    saveDocument: vi.fn(async (savedDocument) => savedDocument),
    loadContent,
    listRevisions: vi.fn(async () => []),
  } as unknown as DocumentListRuntimeState;
}

function saveCategory(
  loadOptions: DocumentListSaveCategory['loadOptions']
): DocumentListSaveCategory {
  return {
    label: 'WebChart category',
    hint: 'Category in the patient chart.',
    placeholder: 'Choose a category',
    loading: 'Loading categories...',
    empty: 'No categories available.',
    retry: 'Retry categories',
    saving: 'Saving to WebChart...',
    pending: 'File selected; not saved yet.',
    loadOptions,
  };
}

/** Stands in for the composer session: owns the draft and the mode. */
function ComposeHarness({
  runtime,
  onOpenChange,
  noun,
}: {
  runtime: DocumentListRuntimeState;
  onOpenChange: (open: boolean) => void;
  noun?: string;
}): React.JSX.Element {
  const [mode, setMode] = useState<DocumentListWorkflowMode>('full');
  const [draft, setDraft] = useState<DocumentListComposeDraft>(() =>
    emptyComposeDraft('Note')
  );
  return (
    <DocumentListComposePanel
      open
      onOpenChange={onOpenChange}
      runtime={runtime}
      noun={noun}
      inputPrefix="form-1-documents"
      mode={mode}
      onModeChange={setMode}
      draft={draft}
      onDraftChange={setDraft}
    />
  );
}

/** The panel portals to `document.body`, so the render container misses it. */
function composeEditor(): HTMLElement | null {
  return globalThis.document.querySelector('.document-list-compose-editor');
}

/** RichEditor assembles its kits asynchronously, so the mount is not instant. */
async function composeEditorInput(): Promise<HTMLTextAreaElement> {
  return await waitFor(() => {
    const input = globalThis.document.querySelector(
      '.document-list-compose-editor textarea'
    );
    if (!input) throw new Error('the compose editor has not mounted yet');
    return input as HTMLTextAreaElement;
  });
}

async function typeDraft(note: string): Promise<void> {
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Visit note' },
  });
  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: 'Follow-up visit' },
  });
  fireEvent.change(await composeEditorInput(), { target: { value: note } });
}

describe('the docked composer', () => {
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    vi.restoreAllMocks();
  });

  it.each(['document', 'letter', 'note'])(
    'confirms discarding a dirty %s without a native dialog',
    async (noun) => {
      const onOpenChange = vi.fn();
      const confirm = vi.spyOn(window, 'confirm');
      render(
        <ComposeHarness
          runtime={createRuntime()}
          onOpenChange={onOpenChange}
          noun={noun}
        />
      );
      await typeDraft('Keep this draft until confirmed.');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.getByRole('dialog', { name: 'Discard draft?' })
      ).toBeTruthy();
      expect(screen.getByText(`Discard this Compose ${noun}?`)).toBeTruthy();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expect(globalThis.document.activeElement).toBe(
        screen.getByRole('button', { name: 'Keep editing' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(
        screen.queryByRole('dialog', { name: 'Discard draft?' })
      ).toBeNull();
      expect((await composeEditorInput()).value).toBe(
        'Keep this draft until confirmed.'
      );

      fireEvent.click(screen.getByRole('button', { name: 'Collapse to dock' }));
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      fireEvent.keyDown(screen.getByRole('button', { name: 'Keep editing' }), {
        key: 'Escape',
      });
      expect(
        screen.queryByRole('dialog', { name: 'Discard draft?' })
      ).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();

      fireEvent.keyDown(globalThis.document, { key: 'Escape' });
      expect(
        screen.getByRole('dialog', { name: 'Discard draft?' })
      ).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
      expect(confirm).not.toHaveBeenCalled();
    }
  );

  it('keeps the draft and the editor alive across a collapse', async () => {
    render(<ComposeHarness runtime={createRuntime()} onOpenChange={vi.fn()} />);

    await typeDraft('Follow-up completed.');
    const editor = composeEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse to dock' }));

    // Collapsed is a class swap, not an unmount: the same editor node stays.
    expect(screen.getByText('Visit note')).toBeTruthy();
    expect(screen.getByLabelText('Unsaved changes')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Restore' })
        .getAttribute('aria-expanded')
    ).toBe('false');
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBeNull();
    expect(composeEditor()).toBe(editor);

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Visit note'
    );
    expect((await composeEditorInput()).value).toBe('Follow-up completed.');
  });

  it('saves a restored draft with the content composed before docking', async () => {
    const runtime = createRuntime();
    render(<ComposeHarness runtime={runtime} onOpenChange={vi.fn()} />);

    await typeDraft('Employer confirmed return date.');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse to dock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    fireEvent.change(screen.getByLabelText('Document Type'), {
      target: { value: 'Clinical note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = (
      runtime.saveDocument as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [DocumentListDocument, FileInput];
    expect(savedDocument.title).toBe('Visit note');
    expect(savedDocument.docType).toBe('Clinical note');
    expect(content.content).toBe('Employer confirmed return date.');
  });

  it('collapses on Escape while dirty and closes when empty', async () => {
    const onOpenChange = vi.fn();
    const composeView = render(
      <ComposeHarness runtime={createRuntime()} onOpenChange={onOpenChange} />
    );

    await typeDraft('Draft in progress.');
    fireEvent.keyDown(globalThis.document, { key: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'Restore' })
        .getAttribute('aria-expanded')
    ).toBe('false');

    composeView.unmount();
    render(
      <ComposeHarness runtime={createRuntime()} onOpenChange={onOpenChange} />
    );
    fireEvent.keyDown(globalThis.document, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('document list workflow panels', () => {
  it('keeps readable previews visible when an unrelated save or deletion fails', async () => {
    const formStore = createFormStore();
    const loadContent = vi.fn(async () => ({
      text: 'Readable preview',
      contentType: 'text/plain',
    }));
    const runtime = createDocumentListRuntimeExtension({
      formStore,
      context: { formInstanceId: 'case-1', fieldId: 'write-failure-preview' },
      repository: {
        ownsField: () => true,
        load: async () => ({ documents: [document] }),
        loadContent,
        save: async () => {
          throw new Error('Write conflict');
        },
        remove: async () => {
          throw new Error('Delete conflict');
        },
      },
    });
    function Detail() {
      const current = useSyncExternalStore(formStore.subscribe, () =>
        getDocumentListRuntimeState(formStore, 'write-failure-preview')
      );
      return current ? (
        <DocumentListDetailRow document={document} runtime={current} />
      ) : null;
    }
    await runtime?.refresh();
    render(<Detail />);
    expect(await screen.findByText('Readable preview')).toBeTruthy();
    await act(async () => {
      await expect(runtime?.saveDocument(document)).rejects.toThrow(
        'Write conflict'
      );
    });
    expect(screen.getByText('Readable preview')).toBeTruthy();
    await act(async () => {
      await expect(runtime?.removeDocument(document.id)).rejects.toThrow(
        'Delete conflict'
      );
    });
    expect(screen.getByText('Readable preview')).toBeTruthy();
    expect(loadContent).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
    runtime?.dispose();
  });
  it('clears an open preview after a failed authorization refresh without refetching stale content', async () => {
    const formStore = createFormStore();
    const load = vi.fn(async () => ({ documents: [document] }));
    const loadContent = vi.fn(async () => ({
      text: 'Private preview',
      contentType: 'text/plain',
    }));
    const runtime = createDocumentListRuntimeExtension({
      formStore,
      context: { formInstanceId: 'case-1', fieldId: 'private-preview' },
      repository: {
        ownsField: () => true,
        load,
        loadContent,
        save: async (_context, row) => row,
        remove: async () => {},
      },
    });
    function Detail() {
      const current = useSyncExternalStore(formStore.subscribe, () =>
        getDocumentListRuntimeState(formStore, 'private-preview')
      );
      return current ? (
        <DocumentListDetailRow document={document} runtime={current} />
      ) : null;
    }
    await runtime?.refresh();
    render(<Detail />);
    expect(await screen.findByText('Private preview')).toBeTruthy();
    load.mockRejectedValueOnce(new Error('Read forbidden'));
    await act(async () => {
      await expect(runtime?.refresh()).rejects.toThrow('Read forbidden');
    });
    expect(screen.queryByText('Private preview')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Read forbidden');
    expect(loadContent).toHaveBeenCalledOnce();
    runtime?.dispose();
  });

  it('renders a PDF from canonical bytes without a reference URL', async () => {
    render(
      <DocumentListDetailRow
        document={document}
        runtime={createRuntime(async () => ({
          blob: new Blob(['%PDF'], { type: 'application/pdf' }),
          contentType: 'application/pdf',
        }))}
      />
    );
    expect(
      await screen.findByLabelText(`PDF preview of ${document.title}`)
    ).toBeTruthy();
    expect(screen.queryByText('No preview for this document.')).toBeNull();
  });
  it.each([
    ['document', 'Document Type'],
    ['letter', 'Letter Type'],
    ['note', 'Note Type'],
  ])('labels the %s type field from its noun', (noun, expectedLabel) => {
    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={createRuntime()}
        inputPrefix={`form-1-${noun}`}
        noun={noun}
      />
    );

    expect(screen.getByLabelText(expectedLabel)).toBeTruthy();
  });

  it.each([
    ['document', 'Document Type'],
    ['letter', 'Letter Type'],
    ['note', 'Note Type'],
  ])(
    'uses the UI Select for %s types with keyboard navigation',
    (noun, label) => {
      const onOpenChange = vi.fn();
      const onModeChange = vi.fn();
      const view = render(
        <DocumentListComposePanel
          open
          onOpenChange={onOpenChange}
          onModeChange={onModeChange}
          runtime={createRuntime()}
          inputPrefix={`custom-${noun}-type`}
          noun={noun}
          fields={['docType']}
          docTypes={[
            { id: 'progress', label: 'Progress note' },
            { id: 'referral', label: 'Referral' },
          ]}
        />
      );
      const select = screen.getByRole('combobox', {
        name: new RegExp(label),
      });
      expect(view.container.querySelector('select')).toBeNull();
      select.focus();
      fireEvent.keyDown(select, { key: 'ArrowDown' });
      expect(screen.getByRole('listbox')).toBeTruthy();
      fireEvent.keyDown(select, { key: 'End' });
      fireEvent.keyDown(select, { key: 'Enter' });
      expect(select.textContent).toContain('Referral');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(globalThis.document.activeElement).toBe(select);

      fireEvent.click(select);
      fireEvent.keyDown(select, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(onModeChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).toBeNull();

      fireEvent.keyDown(select, { key: 'Escape' });
      expect(onModeChange).toHaveBeenCalledWith('docked');
    }
  );

  it('submits editable compose metadata and markdown content', async () => {
    const runtime = createRuntime();
    const onOpenChange = vi.fn();

    render(
      <DocumentListComposePanel
        open
        onOpenChange={onOpenChange}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Visit note' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Follow-up visit' },
    });
    fireEvent.change(screen.getByLabelText('Document Type'), {
      target: { value: 'Clinical note' },
    });
    const noteEditor = await composeEditorInput();
    expect(noteEditor).toBeTruthy();
    fireEvent.change(noteEditor as HTMLTextAreaElement, {
      target: { value: 'Follow-up completed.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = (
      runtime.saveDocument as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [typeof document, FileInput];

    expect(savedDocument).toEqual(
      expect.objectContaining({
        title: 'Visit note',
        subject: 'Follow-up visit',
        docType: 'Clinical note',
        docId: savedDocument.id,
        file: `${savedDocument.id}.md`,
      })
    );
    expect(content).toEqual(
      expect.objectContaining({
        content: 'Follow-up completed.',
        contentType: 'text/x-markdown',
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stamps the host-supplied author onto the saved row', async () => {
    const runtime = createRuntime();

    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
        author={{ id: 'u-casey', name: 'Casey Manager' }}
      />
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Visit note' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Follow-up visit' },
    });
    fireEvent.change(screen.getByLabelText('Document Type'), {
      target: { value: 'Clinical note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument] = (runtime.saveDocument as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [typeof document];
    expect(savedDocument).toEqual(
      expect.objectContaining({
        author: { id: 'u-casey', name: 'Casey Manager' },
      })
    );
  });

  it('keeps an inline document type on the row instead of storing content', async () => {
    const runtime = createRuntime();

    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-notes"
        docTypes={[
          { id: 'progress-note', label: 'Progress note', inline: true },
          { id: 'referral' },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Called employer' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Lisa Ryan' },
    });
    const noteEditor = await composeEditorInput();
    fireEvent.change(noteEditor as HTMLTextAreaElement, {
      target: { value: 'Employer confirmed return date.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = (
      runtime.saveDocument as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [DocumentListDocument, FileInput?];

    expect(savedDocument.docType).toBe('progress-note');
    expect(savedDocument.body).toBe('Employer confirmed return date.');
    expect(content).toBeUndefined();
  });

  it('asks only for the columns the list shows', async () => {
    const runtime = createRuntime();

    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-notes"
        fields={['date', 'title', 'source']}
      />
    );

    expect(screen.queryByLabelText('Subject')).toBeNull();
    expect(screen.queryByLabelText('Document Type')).toBeNull();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Called employer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
  });

  it('validates compose fields and keeps storage errors in the panel', async () => {
    const runtime = createRuntime();
    const saveError = new Error('storage unavailable');
    runtime.saveDocument = vi.fn(async () => {
      throw saveError;
    });

    render(
      <DocumentListComposePanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Title, Subject and Document Type are required.'
    );
    expect(runtime.saveDocument).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Visit note' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Follow-up visit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'storage unavailable'
      )
    );
  });

  it('shows the fixed host category selected and disabled and saves it with the letter', async () => {
    const config = {
      ...saveCategory(async () => [{ id: 'LETTER', label: 'Letter' }]),
      readOnly: true,
    };
    const runtime = { ...createRuntime(), saveCategory: config };
    render(
      <DocumentListComposePanel
        open
        runtime={runtime}
        onOpenChange={vi.fn()}
        inputPrefix="fixed-letter-category"
        noun="letter"
        fields={['title', 'docType']}
        docTypes={[{ id: 'acknowledgement', label: 'Acknowledgement' }]}
        draft={{
          ...emptyComposeDraft('acknowledgement'),
          title: 'Welcome',
          note: 'Body',
        }}
      />
    );
    const category = screen.getByRole('combobox', {
      name: /WebChart category/,
    });
    await waitFor(() =>
      expect(category.textContent).toContain('Letter (LETTER)')
    );
    expect(category).toHaveProperty('disabled', true);
    fireEvent.click(category);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save letter' }));
    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    expect(vi.mocked(runtime.saveDocument).mock.calls[0][0]).toMatchObject({
      docType: 'acknowledgement',
      nativeDocType: 'LETTER',
    });
  });

  it('chooses a category inside compose before saving without opening another dialog', async () => {
    const loadOptions = vi.fn(async () => [
      { id: 'NOTE', label: 'Clinical note' },
      { id: 'LETTER', label: 'Correspondence' },
    ]);
    const runtime = {
      ...createRuntime(),
      saveCategory: saveCategory(loadOptions),
    };
    render(
      <DocumentListComposePanel
        open
        runtime={runtime}
        onOpenChange={vi.fn()}
        inputPrefix="category-compose"
        noun="letter"
        fields={['title', 'docType']}
        docTypes={[{ id: 'acknowledgement', label: 'Acknowledgement' }]}
        draft={{
          ...emptyComposeDraft('acknowledgement'),
          title: 'Welcome',
          note: 'Body',
        }}
      />
    );
    const select = screen.getByRole('combobox', { name: /WebChart category/ });
    await waitFor(() => expect(select).toHaveProperty('disabled', false));
    expect(loadOptions).toHaveBeenCalledWith(
      'acknowledgement',
      expect.any(AbortSignal)
    );
    const save = screen.getByRole('button', { name: 'Save letter' });
    expect(save).toHaveProperty('disabled', true);
    expect(runtime.saveDocument).not.toHaveBeenCalled();
    fireEvent.click(select);
    fireEvent.click(
      screen.getByRole('option', { name: 'Correspondence (LETTER)' })
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(save);
    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    expect(vi.mocked(runtime.saveDocument).mock.calls[0][0]).toMatchObject({
      docType: 'acknowledgement',
      nativeDocType: 'LETTER',
    });
    expect(globalThis.document.querySelector('dialog')).toBeNull();
  });

  it('preselects the only category and keeps upload errors, progress and retry in the dialog', async () => {
    const runtime = {
      ...createRuntime(),
      saveCategory: saveCategory(async () => [
        { id: 'GENERAL', label: 'General document' },
      ]),
    };
    const save = vi.mocked(runtime.saveDocument);
    save.mockRejectedValueOnce(new Error('WebChart unavailable'));
    let resolveSave: (() => void) | undefined;
    save.mockImplementationOnce(
      (document) =>
        new Promise((resolve) => {
          resolveSave = () => resolve(document);
        })
    );
    const onOpenChange = vi.fn();
    const file = new File(['%PDF-1.4'], 'original.pdf', {
      type: 'application/pdf',
    });
    render(
      <DocumentListUploadPanel
        open
        runtime={runtime}
        onOpenChange={onOpenChange}
        inputPrefix="category-upload"
        initialFile={file}
      />
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /WebChart category/ }).textContent
      ).toContain('General document (GENERAL)')
    );
    expect(screen.getByText('File selected; not saved yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    await screen.findByText('WebChart unavailable');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('combobox', { name: /WebChart category/ }).textContent
    ).toContain('General document (GENERAL)');
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    await screen.findByText('Saving to WebChart...');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty(
      'disabled',
      true
    );
    expect(save.mock.calls[0][0].id).toBe(save.mock.calls[1][0].id);
    expect(save.mock.calls[1][0].nativeDocType).toBe('GENERAL');
    expect(save.mock.calls[1][1]?.content).toBe(file);
    resolveSave?.();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('reports category lookup failures and empty results inline and allows retry', async () => {
    const loadOptions = vi
      .fn<DocumentListSaveCategory['loadOptions']>()
      .mockRejectedValueOnce(new Error('Categories unavailable'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'GENERAL', label: 'General' }]);
    const runtime = {
      ...createRuntime(),
      saveCategory: saveCategory(loadOptions),
    };
    render(
      <DocumentListUploadPanel
        open
        runtime={runtime}
        onOpenChange={vi.fn()}
        inputPrefix="category-retry"
      />
    );
    await screen.findByText('Categories unavailable');
    expect(
      screen.getByRole('button', { name: 'Save document' })
    ).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry categories' }));
    await screen.findByText('No categories available.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry categories' }));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /WebChart category/ }).textContent
      ).toContain('General (GENERAL)')
    );
    expect(runtime.saveDocument).not.toHaveBeenCalled();
  });

  it('aborts category loading when the dialog closes', async () => {
    const loadOptions = vi.fn<DocumentListSaveCategory['loadOptions']>(
      () => new Promise(() => {})
    );
    const runtime = {
      ...createRuntime(),
      saveCategory: saveCategory(loadOptions),
    };
    const props = {
      runtime,
      onOpenChange: vi.fn(),
      inputPrefix: 'category-abort',
    };
    const { rerender } = render(<DocumentListUploadPanel {...props} open />);
    await waitFor(() => expect(loadOptions).toHaveBeenCalledOnce());
    const signal = loadOptions.mock.calls[0][1];
    rerender(<DocumentListUploadPanel {...props} open={false} />);
    expect(signal.aborted).toBe(true);
    expect(runtime.saveDocument).not.toHaveBeenCalled();
  });

  it('ignores stale category results after selecting a different file type', async () => {
    let resolveFirst:
      | ((choices: readonly { id: string; label: string }[]) => void)
      | undefined;
    const loadOptions = vi
      .fn<DocumentListSaveCategory['loadOptions']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue([{ id: 'PDF', label: 'PDF documents' }]);
    const runtime = {
      ...createRuntime(),
      saveCategory: saveCategory(loadOptions),
    };
    render(
      <DocumentListUploadPanel
        open
        runtime={runtime}
        onOpenChange={vi.fn()}
        inputPrefix="category-stale"
      />
    );
    await waitFor(() => expect(loadOptions).toHaveBeenCalledOnce());
    const firstSignal = loadOptions.mock.calls[0][1];
    fireEvent.change(screen.getByLabelText('Choose a file'), {
      target: {
        files: [new File(['%PDF'], 'file.pdf', { type: 'application/pdf' })],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /WebChart category/ }).textContent
      ).toContain('PDF documents (PDF)')
    );
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      resolveFirst?.([{ id: 'STALE', label: 'Old choices' }]);
    });
    expect(
      screen.getByRole('combobox', { name: /WebChart category/ }).textContent
    ).toContain('PDF documents (PDF)');
    fireEvent.click(
      screen.getByRole('combobox', { name: /WebChart category/ })
    );
    expect(
      screen.queryByRole('option', { name: 'Old choices (STALE)' })
    ).toBeNull();
  });

  it('displays an existing document category without requesting a new choice', async () => {
    const loadOptions = vi.fn(async () => [{ id: 'OTHER', label: 'Other' }]);
    const existing = { ...document, nativeDocType: 'LETTER' };
    const runtime = {
      ...createRuntime(),
      documents: { [existing.id]: existing },
      saveCategory: saveCategory(loadOptions),
    };
    render(
      <DocumentListComposePanel
        open
        runtime={runtime}
        documentId={existing.id}
        onOpenChange={vi.fn()}
        inputPrefix="category-existing"
      />
    );
    expect(screen.getByLabelText('WebChart category')).toHaveProperty(
      'value',
      'LETTER'
    );
    expect(screen.getByLabelText('WebChart category')).toHaveProperty(
      'readOnly',
      true
    );
    expect(loadOptions).not.toHaveBeenCalled();
  });

  it('keeps an editable title separate from the original technical filename', async () => {
    const runtime = createRuntime();
    const onOpenChange = vi.fn();
    const file = new File(['image data'], 'original.png', {
      type: 'image/png',
    });

    render(
      <DocumentListUploadPanel
        open
        onOpenChange={onOpenChange}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );

    fireEvent.change(screen.getByLabelText('Choose a file'), {
      target: { files: [file] },
    });
    expect(screen.queryByLabelText('Stored filename')).toBeNull();
    expect(screen.getByLabelText('Title')).toHaveProperty(
      'value',
      'original.png'
    );
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Clinical image' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = (
      runtime.saveDocument as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [typeof document, FileInput];

    expect(savedDocument).toEqual(
      expect.objectContaining({
        title: 'Clinical image',
        docType: 'image/png',
        file: 'original.png',
      })
    );
    expect(content).toEqual(
      expect.objectContaining({
        content: file,
        contentType: 'image/png',
        size: file.size,
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the upload identity and selected bytes when retrying an uncertain save', async () => {
    const runtime = createRuntime();
    const save = vi.mocked(runtime.saveDocument);
    save.mockRejectedValueOnce(new Error('Response lost'));
    const file = new File(['%PDF-1.4'], 'original.pdf', {
      type: 'application/pdf',
    });
    render(
      <DocumentListUploadPanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="retry-documents"
      />
    );
    fireEvent.change(screen.getByLabelText('Choose a file'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    await screen.findByText('Response lost');
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[0][0].id).toBe(save.mock.calls[1][0].id);
    expect(save.mock.calls[1][1]?.content).toBe(file);
  });

  it('requires a title without changing the technical filename', () => {
    const runtime = createRuntime();
    render(
      <DocumentListUploadPanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="required-title"
        initialFile={
          new File(['data'], 'original.pdf', { type: 'application/pdf' })
        }
      />
    );
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Choose a file and enter a title.'
    );
    expect(runtime.saveDocument).not.toHaveBeenCalled();
  });

  it('rejects upload types excluded by the shared accept matcher', () => {
    const runtime = createRuntime();
    const file = new File(['image data'], 'photo.png', {
      type: 'image/png',
    });

    render(
      <DocumentListUploadPanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
        accept="application/pdf"
      />
    );

    fireEvent.change(screen.getByLabelText('Choose a file'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'File type not accepted: photo.png'
    );
    expect(runtime.saveDocument).not.toHaveBeenCalled();
  });

  it('resets upload form state when cancelled', () => {
    const runtime = createRuntime();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <DocumentListUploadPanel
        open
        onOpenChange={onOpenChange}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );

    fireEvent.change(screen.getByLabelText('Choose a file'), {
      target: {
        files: [new File(['draft'], 'draft.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Draft title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <DocumentListUploadPanel
        open
        onOpenChange={onOpenChange}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });

  it('adopts a file dropped on the drop zone', () => {
    const runtime = createRuntime();
    const file = new File(['dropped'], 'dropped.pdf', {
      type: 'application/pdf',
    });

    render(
      <DocumentListUploadPanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );

    // The panel portals to document.body; `document` is shadowed in scope.
    const dropzone = window.document.querySelector(
      '.document-list-upload__dropzone'
    ) as HTMLElement;
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'dropped.pdf'
    );
  });

  it('arrives pre-selected when given an initial file', () => {
    const runtime = createRuntime();
    render(
      <DocumentListUploadPanel
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
        initialFile={
          new File(['prefilled'], 'prefilled.png', { type: 'image/png' })
        }
      />
    );
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'prefilled.png'
    );
  });
});

describe('document list detail row', () => {
  it('records a PDF view only after the viewer is ready, once per opening', async () => {
    const onViewed = vi.fn();
    render(
      <DocumentListDetailRow
        document={document}
        runtime={createRuntime(async () => ({
          reference: '/file.pdf',
          contentType: 'application/pdf',
        }))}
        onViewed={onViewed}
      />
    );
    expect(
      await screen.findByLabelText(`PDF preview of ${document.title}`)
    ).toBeTruthy();
    expect(onViewed).not.toHaveBeenCalled();
    act(() => {
      pdfPreview.onReady?.();
      pdfPreview.onReady?.();
    });
    expect(onViewed).toHaveBeenCalledOnce();
  });

  it('does not record failed or closed-before-loaded previews as viewed', async () => {
    const onViewed = vi.fn();
    const failed = render(
      <DocumentListDetailRow
        document={document}
        runtime={createRuntime(async () => {
          throw new Error('Access denied');
        })}
        onViewed={onViewed}
      />
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onViewed).not.toHaveBeenCalled();
    failed.unmount();

    let finish!: (content: DocumentListContent) => void;
    const loading = new Promise<DocumentListContent>((resolve) => {
      finish = resolve;
    });
    const closed = render(
      <DocumentListDetailRow
        document={document}
        runtime={createRuntime(() => loading)}
        onViewed={onViewed}
      />
    );
    closed.unmount();
    await act(async () => {
      finish({ text: 'Loaded after close' });
    });
    expect(onViewed).not.toHaveBeenCalled();
  });

  it('records an image view only when the image loads, once per opening', async () => {
    const onViewed = vi.fn();
    render(
      <DocumentListDetailRow
        document={document}
        runtime={createRuntime(async () => ({
          reference: '/image.png',
          contentType: 'image/png',
        }))}
        onViewed={onViewed}
      />
    );
    const image = await screen.findByRole('img');
    expect(onViewed).not.toHaveBeenCalled();
    fireEvent.load(image);
    fireEvent.load(image);
    expect(onViewed).toHaveBeenCalledOnce();
  });

  it.each(['caseNotes', 'letterLog', 'caseDocuments'])(
    'caches text detail content for %s across closing and reopening',
    async (fieldId) => {
      const formStore = createFormStore();
      const row = { ...document, nativeVersion: 'v1' };
      const loadContent = vi.fn(async () => ({
        document: row,
        text: 'Cached detail content',
        contentType: 'text/plain',
      }));
      const runtime = createDocumentListRuntimeExtension({
        formStore,
        context: { formInstanceId: 'case-1', fieldId },
        repository: {
          ownsField: () => true,
          load: async () => ({ documents: [row] }),
          loadContent,
          save: async (_context, saved) => saved,
          remove: async () => undefined,
        },
      });
      function Detail(): React.JSX.Element | null {
        const current = useSyncExternalStore(formStore.subscribe, () =>
          getDocumentListRuntimeState(formStore, fieldId)
        );
        return current ? (
          <DocumentListDetailRow document={row} runtime={current} />
        ) : null;
      }
      try {
        await runtime?.refresh();
        const first = render(<Detail />);
        expect(await screen.findByText('Cached detail content')).toBeTruthy();
        first.unmount();

        const reopened = render(<Detail />);
        expect(await screen.findByText('Cached detail content')).toBeTruthy();
        expect(loadContent).toHaveBeenCalledOnce();
        reopened.unmount();

        await runtime?.saveDocument(row);
        const afterSave = render(<Detail />);
        expect(await screen.findByText('Cached detail content')).toBeTruthy();
        expect(loadContent).toHaveBeenCalledTimes(2);
        afterSave.unmount();
      } finally {
        runtime?.dispose();
      }
    }
  );

  it('downloads a PDF only once across closing and reopening the subscribed detail row', async () => {
    const fetchFile = vi.fn(async () => new Response('%PDF-original'));
    vi.stubGlobal('fetch', fetchFile);
    const formStore = createFormStore();
    const row = { ...document, nativeVersion: 'v1' };
    const loadContent = vi.fn(async () => ({
      document: row,
      reference: '/api/original.pdf',
      contentType: 'application/pdf',
    }));
    const runtime = createDocumentListRuntimeExtension({
      formStore,
      context: { formInstanceId: 'case-1', fieldId: 'documents' },
      repository: {
        ownsField: () => true,
        load: async () => ({ documents: [row] }),
        loadContent,
        save: async (_context, saved) => saved,
        remove: async () => undefined,
      },
    });
    function Detail(): React.JSX.Element | null {
      const current = useSyncExternalStore(formStore.subscribe, () =>
        getDocumentListRuntimeState(formStore, 'documents')
      );
      return current ? (
        <DocumentListDetailRow document={row} runtime={current} />
      ) : null;
    }
    try {
      await runtime?.refresh();
      const first = render(<Detail />);
      expect(
        await screen.findByLabelText(`PDF preview of ${document.title}`)
      ).toBeTruthy();
      expect(loadContent).toHaveBeenCalledOnce();
      first.unmount();

      const reopened = render(<Detail />);
      expect(
        await screen.findByLabelText(`PDF preview of ${document.title}`)
      ).toBeTruthy();
      expect(loadContent).toHaveBeenCalledOnce();
      expect(fetchFile).toHaveBeenCalledOnce();
      reopened.unmount();
    } finally {
      runtime?.dispose();
      vi.unstubAllGlobals();
    }
  });

  it('does not reload for runtime state updates but reloads when the document version changes', async () => {
    const loadContent = vi.fn(async () => ({
      text: 'Loaded note',
      contentType: 'text/plain',
    }));
    const runtime = createRuntime(loadContent);
    const row = { ...document, nativeVersion: 'v1', rev: 1 };
    const view = render(
      <DocumentListDetailRow document={row} runtime={runtime} />
    );
    expect(await screen.findByText('Loaded note')).toBeTruthy();

    view.rerender(
      <DocumentListDetailRow
        document={{ ...row }}
        runtime={{ ...runtime, syncStatus: 'loading' }}
      />
    );
    expect(loadContent).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).toBeNull();

    view.rerender(
      <DocumentListDetailRow
        document={{ ...row, nativeVersion: 'v2' }}
        runtime={runtime}
      />
    );
    await waitFor(() => expect(loadContent).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Loaded note')).toBeTruthy();

    view.rerender(
      <DocumentListDetailRow
        document={{ ...row, nativeVersion: 'v2', rev: 2 }}
        runtime={runtime}
      />
    );
    await waitFor(() => expect(loadContent).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('Loaded note')).toBeTruthy();
  });

  it('renders loaded text content inline', async () => {
    const content: DocumentListContent = {
      text: 'Loaded note',
      contentType: 'text/plain',
      size: 11,
    };
    const runtime = createRuntime(async () => content);

    render(<DocumentListDetailRow document={document} runtime={runtime} />);

    expect(await screen.findByText('Loaded note')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders markdown content as formatted preview', async () => {
    const content: DocumentListContent = {
      text: '# Visit note\n\n- First item\n- Second item',
      contentType: 'text/x-markdown',
      size: 42,
    };
    const runtime = createRuntime(async () => content);

    const detailView = render(
      <DocumentListDetailRow document={document} runtime={runtime} />
    );

    expect(
      await screen.findByRole('heading', { name: 'Visit note' })
    ).toBeTruthy();
    expect(detailView.container.querySelector('ul')).toBeTruthy();
    expect(detailView.container.querySelector('li')?.textContent).toBe(
      'First item'
    );
    const preview = detailView.container.querySelector(
      '.document-list-detail__preview'
    );
    expect(preview).toBeTruthy();
    expect(preview?.textContent).not.toContain('# Visit note');
    expect(preview?.textContent).not.toContain('- First item');
  });

  it('renders Kerebron body-only pipe tables in the markdown preview', async () => {
    const runtime = createRuntime(async () => ({
      text: '| Name | Status |\n| Visit | Complete |\n| Follow-up | Open |',
      contentType: 'text/x-markdown',
      size: 64,
    }));

    const detailView = render(
      <DocumentListDetailRow document={document} runtime={runtime} />
    );

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(detailView.container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getByText('Follow-up')).toBeTruthy();
  });

  it('renders image references and says so when there is nothing to preview', async () => {
    const imageRuntime = createRuntime(async () => ({
      reference: 'https://example.test/document.png',
      contentType: 'image/png',
      size: 12,
    }));
    const imageView = render(
      <DocumentListDetailRow document={document} runtime={imageRuntime} />
    );

    expect(
      (await screen.findByRole('img', { name: document.title })).getAttribute(
        'src'
      )
    ).toBe('https://example.test/document.png');
    imageView.unmount();

    const fallbackRuntime = createRuntime(async () => ({
      reference: 'document.bin',
      contentType: 'application/octet-stream',
      size: 2048,
    }));
    render(
      <DocumentListDetailRow document={document} runtime={fallbackRuntime} />
    );

    expect(
      await screen.findByText('No preview for this document.')
    ).toBeTruthy();
    // The grid already carries the row's date, title, type and source.
    expect(screen.queryByText(document.docType)).toBeNull();
    expect(screen.queryByText(document.source)).toBeNull();
  });

  it.each(['application/pdf', 'APPLICATION/PDF; version=1.7'])(
    'renders an uploaded PDF reference inline for %s',
    async (contentType) => {
      const reference = 'blob:https://example.test/uploaded-pdf';
      const runtime = createRuntime(async () => ({
        reference,
        contentType,
        size: 2048,
      }));
      const view = render(
        <DocumentListDetailRow document={document} runtime={runtime} />
      );

      const preview = await screen.findByLabelText(
        `PDF preview of ${document.title}`
      );
      expect(preview.getAttribute('data-reference')).toBe(reference);
      expect(view.container.querySelector('iframe, embed, object')).toBeNull();
      expect(screen.queryByText('No preview for this document.')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    }
  );

  it('does not embed a PDF without a content reference', async () => {
    const runtime = createRuntime(async () => ({
      contentType: 'application/pdf',
    }));
    render(<DocumentListDetailRow document={document} runtime={runtime} />);

    expect(
      await screen.findByText('No preview for this document.')
    ).toBeTruthy();
    expect(screen.queryByTitle(document.title)).toBeNull();
  });

  it('reports a PDF download failure instead of embedding a missing file', async () => {
    const runtime = createRuntime(async () => {
      throw new Error('Document download failed (HTTP 404).');
    });
    render(<DocumentListDetailRow document={document} runtime={runtime} />);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not load document content: Document download failed (HTTP 404).'
    );
    expect(screen.queryByTitle(document.title)).toBeNull();
    expect(screen.queryByText('No preview for this document.')).toBeNull();
  });

  it('reports a content loading failure', async () => {
    const runtime = createRuntime(async () => {
      throw new Error('content unavailable');
    });

    render(<DocumentListDetailRow document={document} runtime={runtime} />);

    expect(
      await screen.findByText(
        'Could not load document content: content unavailable'
      )
    ).toBeTruthy();
    expect(screen.queryByText('No preview for this document.')).toBeNull();
  });

  // ED.43 revised: the detail row stays clean — the revisions live on the
  // host's full-page view, reached through the history link.
  it('links to the host document view instead of inlining the history', async () => {
    const runtime = createRuntime(async () => ({ text: 'current prose' }));

    render(
      <DocumentListDetailRow
        document={{ ...document, rev: 2 }}
        runtime={runtime}
        historyHref="#/case/c-1/document/doc-1"
      />
    );

    const link = await screen.findByRole('link', {
      name: 'Revision history (rev 2)',
    });
    expect(link.getAttribute('href')).toBe('#/case/c-1/document/doc-1');
    expect(screen.queryByRole('region', { name: 'Revisions' })).toBeNull();
  });

  it('shows no history link when the host offers no document view', async () => {
    const runtime = createRuntime(async () => ({ text: 'current prose' }));

    render(<DocumentListDetailRow document={document} runtime={runtime} />);

    await screen.findByText('current prose');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
