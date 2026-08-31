import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type {
  AttachmentAnswer,
  FieldComponentProps,
  FileReference,
  FileStore,
} from '@esheet/core';
import { FileField } from './FileField.js';
import { createFileStoreProvider } from '../../lib/FileStoreProvider.js';

// ---------------------------------------------------------------------------
// The contract: with a manager the response carries a reference and never the
// bytes; without one it carries the bytes exactly as it always has.
// ---------------------------------------------------------------------------

function fakeStore(): FileStore & { removed: FileReference[] } {
  const removed: FileReference[] = [];
  return {
    removed,
    store: async (input) => ({
      id: `blobs/${input.title}`,
      contentType: input.contentType,
      title: input.title,
      size: input.size,
    }),
    load: async (reference) => ({
      content: new Blob(['loaded']),
      contentType: reference.contentType,
      title: reference.title,
      size: reference.size,
    }),
    remove: async (reference) => {
      removed.push(reference);
    },
  };
}

/** Renders through the provider stack exactly as the renderer would. */
function withStore(store: FileStore, children: React.ReactNode) {
  return createFileStoreProvider(store)(children);
}

function props(
  definition: Record<string, unknown>,
  overrides: Partial<FieldComponentProps> = {}
): FieldComponentProps {
  return {
    field: { definition: { id: 'attachment', ...definition } },
    form: { getState: () => ({ instanceId: 'test' }) },
    isPreview: true,
    isEnabled: true,
    isReadOnly: false,
    isRequired: false,
    isSoftRequired: false,
    onResponse: vi.fn(),
    onUpdate: vi.fn(),
    ...overrides,
  } as unknown as FieldComponentProps;
}

const pick = (label: string, file: File) => {
  const input = screen
    .getByLabelText(label)
    .parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
};

const report = () => new File(['bytes'], 'report.txt', { type: 'text/plain' });

describe('FileField file storage', () => {
  it('stores through the file store and keeps only the reference', async () => {
    const store = fakeStore();
    const fieldProps = props({ fieldType: 'file', question: 'Upload file' });

    render(withStore(store, <FileField {...fieldProps} />));
    pick('Choose file or drag and drop', report());

    await waitFor(() => expect(fieldProps.onResponse).toHaveBeenCalled());
    expect(fieldProps.onResponse).toHaveBeenCalledWith({
      fileData: {
        contentType: 'text/plain',
        title: 'report.txt',
        size: 5,
        fileReference: {
          id: 'blobs/report.txt',
          contentType: 'text/plain',
          title: 'report.txt',
          size: 5,
        },
      },
    });
  });

  it('keeps the bytes inline when no file store is supplied', async () => {
    const fieldProps = props({ fieldType: 'file', question: 'Upload file' });

    render(<FileField {...fieldProps} />);
    pick('Choose file or drag and drop', report());

    await waitFor(() => expect(fieldProps.onResponse).toHaveBeenCalled());
    const { fileData } = (fieldProps.onResponse as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(fileData.dataUrl).toMatch(/^data:text\/plain/);
  });

  it('tells the file store when a file is removed', async () => {
    const store = fakeStore();
    const reference: FileReference = {
      id: 'blobs/report.txt',
      contentType: 'text/plain',
      title: 'report.txt',
      size: 5,
    };
    const stored: AttachmentAnswer = {
      contentType: 'text/plain',
      title: 'report.txt',
      size: 5,
      fileReference: reference,
    };
    const fieldProps = props(
      { fieldType: 'file', question: 'Upload file' },
      { response: { fileData: stored } }
    );

    render(withStore(store, <FileField {...fieldProps} />));
    fireEvent.click(screen.getByLabelText('Remove report.txt'));

    await waitFor(() => expect(store.removed).toEqual([reference]));
    expect(fieldProps.onResponse).toHaveBeenCalledWith({ fileData: undefined });
  });
});
