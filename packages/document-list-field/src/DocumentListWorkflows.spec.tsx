import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  DocumentListContent,
  DocumentListContentInput,
  DocumentListRuntimeState,
} from './document-list-runtime.js';
import {
  DocumentListComposeModal,
  DocumentListDetailRow,
  DocumentListUploadModal,
} from './DocumentListWorkflows.js';

vi.mock('@kerebron/editor', () => ({
  CoreEditor: {
    create: ({
      element,
      readOnly = false,
    }: {
      element: HTMLElement;
      readOnly?: boolean;
    }) => {
      const eventTarget = new EventTarget();
      let editorValue = '';
      const editorInput = readOnly
        ? null
        : globalThis.document.createElement('textarea');
      if (editorInput) {
        editorInput.setAttribute('aria-label', 'Note');
      }
      const renderMarkdown = (markdown: string): void => {
        const proseMirror = globalThis.document.createElement('div');
        proseMirror.className = 'kb-editor ProseMirror';
        let list: HTMLUListElement | null = null;

        for (const line of markdown.split(/\r?\n/)) {
          const heading = /^(#{1,6})\s+(.+)$/.exec(line);
          const listItem = /^\s*[-*]\s+(.+)$/.exec(line);
          if (heading) {
            list = null;
            const headingElement = globalThis.document.createElement(
              `h${heading[1].length}`
            );
            headingElement.textContent = heading[2];
            proseMirror.appendChild(headingElement);
          } else if (listItem) {
            if (!list) {
              list = globalThis.document.createElement('ul');
              proseMirror.appendChild(list);
            }
            const listElement = globalThis.document.createElement('li');
            listElement.textContent = listItem[1];
            list.appendChild(listElement);
          } else if (line.trim()) {
            list = null;
            const paragraph = globalThis.document.createElement('p');
            paragraph.textContent = line;
            proseMirror.appendChild(paragraph);
          } else {
            list = null;
          }
        }

        element.replaceChildren(proseMirror);
      };
      const editor = {
        addEventListener: eventTarget.addEventListener.bind(eventTarget),
        removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
        view: { setProps: vi.fn() },
        loadDocument: vi.fn(async (_mediaType: string, content: Uint8Array) => {
          const nextValue = new TextDecoder().decode(content);
          editorValue = nextValue;
          if (editorInput) {
            editorInput.value = nextValue;
          } else {
            renderMarkdown(nextValue);
          }
        }),
        saveDocument: vi.fn(async () => new TextEncoder().encode(editorValue)),
        destroy: vi.fn(),
      };
      const updateValue = (): void => {
        if (!editorInput) return;
        editorValue = editorInput.value;
        eventTarget.dispatchEvent(new Event('changed'));
      };
      if (editorInput) {
        editorInput.addEventListener('input', updateValue);
        editorInput.addEventListener('change', updateValue);
        element.appendChild(editorInput);
      }
      return editor;
    },
  },
}));

vi.mock('@kerebron/editor-kits/AdvancedEditorKit', () => ({
  AdvancedEditorKit: class AdvancedEditorKit {},
}));

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
  } as unknown as DocumentListRuntimeState;
}

describe('document list workflow modals', () => {
  it('submits editable compose metadata and markdown content', async () => {
    const runtime = createRuntime();
    const onOpenChange = vi.fn();

    const documentView = render(
      <DocumentListComposeModal
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
    const noteEditor = documentView.container.querySelector(
      '.document-list-compose-editor textarea'
    );
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

  it('follows Mieweb UI dark mode changes without remounting', async () => {
    const root = globalThis.document.documentElement;
    const initialClassName = root.className;
    const initialTheme = root.getAttribute('data-theme');
    root.classList.remove('dark');
    root.removeAttribute('data-theme');

    try {
      const documentView = render(
        <DocumentListComposeModal
          open
          onOpenChange={vi.fn()}
          runtime={createRuntime()}
          inputPrefix="form-1-documents"
        />
      );
      const editor = documentView.container.querySelector(
        '.document-list-compose-editor'
      );

      expect(editor).toBeTruthy();
      expect(editor?.classList.contains('kb-component--dark')).toBe(false);

      root.classList.add('dark');
      await waitFor(() =>
        expect(editor?.classList.contains('kb-component--dark')).toBe(true)
      );

      root.classList.remove('dark');
      root.dataset.theme = 'dark';
      await waitFor(() =>
        expect(editor?.classList.contains('kb-component--dark')).toBe(true)
      );

      root.removeAttribute('data-theme');
      await waitFor(() =>
        expect(editor?.classList.contains('kb-component--dark')).toBe(false)
      );
      documentView.unmount();
    } finally {
      root.className = initialClassName;
      if (initialTheme === null) {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', initialTheme);
      }
    }
  });

  it('validates compose fields and keeps storage errors in the modal', async () => {
    const runtime = createRuntime();
    const saveError = new Error('storage unavailable');
    runtime.saveDocument = vi.fn(async () => {
      throw saveError;
    });

    render(
      <DocumentListComposeModal
        open
        onOpenChange={vi.fn()}
        runtime={runtime}
        inputPrefix="form-1-documents"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Title, subject, and document type are required.'
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
      <DocumentListUploadModal
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
      <DocumentListUploadModal
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
      <DocumentListUploadModal
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

  it('renders image references and metadata fallback content', async () => {
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

    expect(await screen.findByText('document.pdf')).toBeTruthy();
    expect(screen.getByText('application/pdf')).toBeTruthy();
    expect(screen.getByText('2048 bytes')).toBeTruthy();
  });

  it('falls back to metadata when content loading fails', async () => {
    const runtime = createRuntime(async () => {
      throw new Error('content unavailable');
    });

    render(<DocumentListDetailRow document={document} runtime={runtime} />);

    expect(
      await screen.findByText(
        'Could not load document content: content unavailable'
      )
    ).toBeTruthy();
    expect(screen.getByText(document.file)).toBeTruthy();
  });
});
