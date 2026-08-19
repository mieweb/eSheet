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

vi.mock('@mieweb/ui', () => {
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
  it('submits editable compose metadata and transient text content', async () => {
    const runtime = createRuntime();
    const onOpenChange = vi.fn();

    render(
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
    fireEvent.change(screen.getByLabelText('Note'), {
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
        file: `${savedDocument.id}.txt`,
      })
    );
    expect(content).toEqual(
      expect.objectContaining({
        content: 'Follow-up completed.',
        contentType: 'text/plain',
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
