import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type {
  DocumentListContent,
  DocumentListContentInput,
  DocumentListRuntimeState,
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
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
  }) => (
    <label>
      {label}
      <input {...props} />
      {error && <span>{error}</span>}
    </label>
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

/** Stands in for the composer session: owns the draft and the mode. */
function ComposeHarness({
  runtime,
  onOpenChange,
}: {
  runtime: DocumentListRuntimeState;
  onOpenChange: (open: boolean) => void;
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
    fireEvent.change(screen.getByLabelText('Document type'), {
      target: { value: 'Clinical note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = (
      runtime.saveDocument as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [DocumentListDocument, DocumentListContentInput];
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
    fireEvent.change(screen.getByLabelText('Document type'), {
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
    ).mock.calls[0] as [typeof document, DocumentListContentInput];

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
    fireEvent.change(screen.getByLabelText('Document type'), {
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
    ).mock.calls[0] as [DocumentListDocument, DocumentListContentInput?];

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
    expect(screen.queryByLabelText('Document type')).toBeNull();

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
      'Title, Subject and Document type are required.'
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

  it('derives upload metadata from the original file and forwards the renamed file', async () => {
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
    fireEvent.change(screen.getByLabelText('Stored filename'), {
      target: { value: 'renamed-image.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = (
      runtime.saveDocument as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [typeof document, DocumentListContentInput];

    expect(savedDocument).toEqual(
      expect.objectContaining({
        title: 'original.png',
        docType: 'image/png',
        file: 'renamed-image.png',
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
    fireEvent.change(screen.getByLabelText('Stored filename'), {
      target: { value: 'draft.pdf' },
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
    expect(
      (screen.getByLabelText('Stored filename') as HTMLInputElement).value
    ).toBe('');
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
    expect(
      (screen.getByLabelText('Stored filename') as HTMLInputElement).value
    ).toBe('dropped.pdf');
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
    expect(
      (screen.getByLabelText('Stored filename') as HTMLInputElement).value
    ).toBe('prefilled.png');
  });
});

describe('document list detail row', () => {
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
      reference: 'document.pdf',
      contentType: 'application/pdf',
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
