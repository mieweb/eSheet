import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type {
  AttachmentAnswer,
  AttachmentManager,
  FieldComponentProps,
} from '@esheet/core';
import { FileField } from './FileField.js';
import { NotesField } from './NotesField.js';
import { createAttachmentManagerProvider } from '../../lib/AttachmentManagerProvider.js';

// ---------------------------------------------------------------------------
// The contract: with a manager the response carries a reference and never the
// bytes; without one it carries the bytes exactly as it always has.
// ---------------------------------------------------------------------------

function fakeManager(): AttachmentManager & { removed: AttachmentAnswer[] } {
  const removed: AttachmentAnswer[] = [];
  return {
    removed,
    store: async ({ dataUrl: _dataUrl, ...rest }: AttachmentAnswer) => ({
      ...rest,
      path: `blobs/${rest.title}`,
    }),
    load: async (attachment) => ({ ...attachment, dataUrl: 'data:,loaded' }),
    remove: async (attachment) => {
      removed.push(attachment);
    },
  };
}

/** Renders through the provider stack exactly as the renderer would. */
function withManager(manager: AttachmentManager, children: React.ReactNode) {
  return createAttachmentManagerProvider(manager)(children);
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

describe('FileField attachment storage', () => {
  it('stores through the manager and keeps only the reference', async () => {
    const manager = fakeManager();
    const fieldProps = props({ fieldType: 'file', question: 'Upload file' });

    render(withManager(manager, <FileField {...fieldProps} />));
    pick('Choose file or drag and drop', report());

    await waitFor(() => expect(fieldProps.onResponse).toHaveBeenCalled());
    expect(fieldProps.onResponse).toHaveBeenCalledWith({
      fileData: {
        contentType: 'text/plain',
        title: 'report.txt',
        size: 5,
        path: 'blobs/report.txt',
      },
    });
  });

  it('keeps the bytes inline when no manager is supplied', async () => {
    const fieldProps = props({ fieldType: 'file', question: 'Upload file' });

    render(<FileField {...fieldProps} />);
    pick('Choose file or drag and drop', report());

    await waitFor(() => expect(fieldProps.onResponse).toHaveBeenCalled());
    const { fileData } = (fieldProps.onResponse as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(fileData.dataUrl).toMatch(/^data:text\/plain/);
  });

  it('tells the manager when a file is removed', async () => {
    const manager = fakeManager();
    const stored = { contentType: 'text/plain', title: 'report.txt', size: 5 };
    const fieldProps = props(
      { fieldType: 'file', question: 'Upload file' },
      { response: { fileData: stored } }
    );

    render(withManager(manager, <FileField {...fieldProps} />));
    fireEvent.click(screen.getByLabelText('Remove report.txt'));

    await waitFor(() => expect(manager.removed).toEqual([stored]));
    expect(fieldProps.onResponse).toHaveBeenCalledWith({ fileData: undefined });
  });
});

describe('NotesField attachment storage', () => {
  const openComposerAndSave = async (label: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [report()] } });
    await screen.findByText(label);
    fireEvent.change(screen.getByLabelText('Note text'), {
      target: { value: 'Saw the patient' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  };

  it('stores composed attachments before the note reaches the response', async () => {
    const manager = fakeManager();
    const fieldProps = props({
      fieldType: 'notes',
      question: 'Case notes',
      allowAttachments: true,
    });

    render(withManager(manager, <NotesField {...fieldProps} />));
    await openComposerAndSave('report.txt');

    await waitFor(() => expect(fieldProps.onResponse).toHaveBeenCalled());
    const { notes } = (fieldProps.onResponse as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(notes[0].attachments).toEqual([
      {
        contentType: 'text/plain',
        title: 'report.txt',
        size: 5,
        path: 'blobs/report.txt',
      },
    ]);
  });

  it('keeps composed attachments inline when no manager is supplied', async () => {
    const fieldProps = props({
      fieldType: 'notes',
      question: 'Case notes',
      allowAttachments: true,
    });

    render(<NotesField {...fieldProps} />);
    await openComposerAndSave('report.txt');

    await waitFor(() => expect(fieldProps.onResponse).toHaveBeenCalled());
    const { notes } = (fieldProps.onResponse as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(notes[0].attachments[0].dataUrl).toMatch(/^data:text\/plain/);
  });

  it('tells the manager when a note carrying attachments is deleted', async () => {
    const manager = fakeManager();
    const stored = { contentType: 'text/plain', title: 'report.txt', size: 5 };
    const fieldProps = props(
      { fieldType: 'notes', question: 'Case notes' },
      {
        response: {
          notes: [
            {
              id: 'n1',
              createdAt: '2026-01-01T00:00:00Z',
              markdown: 'Saw the patient',
              attachments: [stored],
            },
          ],
        },
      }
    );

    render(withManager(manager, <NotesField {...fieldProps} />));
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(manager.removed).toEqual([stored]));
  });
});
