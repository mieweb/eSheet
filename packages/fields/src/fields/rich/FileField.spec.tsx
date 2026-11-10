import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type {
  AttachmentAnswer,
  FieldComponentProps,
  FileInput,
} from '@esheet/core';
import { FileField } from './FileField.js';
import { DocumentPickerDialog } from '../../lib/DocumentPickerDialog.js';

const mocks = vi.hoisted(() => ({
  dialog: vi.fn(() => null),
  fetch: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('../../lib/DocumentPickerDialog.js', () => ({
  DocumentPickerDialog: mocks.dialog,
}));
vi.mock('../../lib/DocumentPickerProvider.js', () => ({
  useDocumentPicker: () => ({ fetch: mocks.fetch }),
}));
vi.mock('../../lib/FileStoreProvider.js', () => ({
  useFileStore: () => undefined,
  removeUnreferencedFiles: vi.fn(),
}));
vi.mock('../../lib/file-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/file-utils.js')>()),
  readFileAsAttachment: mocks.readFile,
}));

const attachment: AttachmentAnswer = {
  title: 'existing.pdf',
  contentType: 'application/pdf',
  dataUrl: 'data:application/pdf;base64,existing',
};

function createProps(): FieldComponentProps {
  return {
    field: {
      definition: {
        id: 'file',
        fieldType: 'file',
        maxFiles: 2,
        accept: '.pdf',
      },
    },
    form: { getState: () => ({ instanceId: 'test' }) },
    response: { fileData: [attachment] },
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
  } as unknown as FieldComponentProps;
}

async function pickDocument() {
  fireEvent.click(screen.getByText('Choose from chart'));
  await act(async () => {
    vi.mocked(DocumentPickerDialog).mock.calls.at(-1)![0].onSelect({
      id: 'chart',
      title: 'chart.pdf',
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readFile.mockResolvedValue({ ...attachment, title: 'chart.pdf' });
});

afterEach(cleanup);

describe('FileField chart attachments', () => {
  it('normalizes MIME parameters before validating and storing a chart file', async () => {
    mocks.fetch.mockResolvedValue({
      content: new Blob(['text']),
      contentType: 'text/plain; charset=utf-8',
      title: 'chart.txt',
    });
    const defaults = createProps();
    const props: FieldComponentProps = {
      ...defaults,
      field: {
        ...defaults.field,
        definition: {
          ...defaults.field.definition,
          fieldType: 'file',
          accept: 'text/plain',
        },
      },
    };
    render(<FileField {...props} />);

    await pickDocument();

    expect(mocks.readFile).toHaveBeenCalledOnce();
    expect(mocks.readFile.mock.calls[0][0].type).toBe('text/plain');
    expect(props.onResponse).toHaveBeenCalledOnce();
    expect(screen.queryByText('File type not accepted: chart.txt')).toBeNull();
  });

  it('passes the accept filter to the picker and rejects mismatched fetched files', async () => {
    mocks.fetch.mockResolvedValue({
      content: new Blob(['image']),
      contentType: 'image/png',
      title: 'chart.png',
    });
    const props = createProps();
    render(<FileField {...props} />);

    await pickDocument();

    expect(vi.mocked(DocumentPickerDialog).mock.calls[0][0].accept).toBe(
      '.pdf'
    );
    expect(screen.getByText('File type not accepted: chart.png')).toBeTruthy();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(props.onResponse).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'Remove existing.pdf' })
        .hasAttribute('disabled')
    ).toBe(false);
  });

  it('blocks removal and local uploads while a chart fetch is pending', async () => {
    let resolveFetch!: (input: FileInput) => void;
    mocks.fetch.mockReturnValue(
      new Promise<FileInput>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const props = createProps();
    const { container } = render(<FileField {...props} />);
    await pickDocument();

    const remove = screen.getByRole('button', { name: 'Remove existing.pdf' });
    expect(remove.hasAttribute('disabled')).toBe(true);
    fireEvent.click(remove);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['local'], 'local.pdf')] },
    });
    expect(props.onResponse).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();

    await act(async () => {
      resolveFetch({
        content: new Blob(['pdf']),
        contentType: 'application/pdf',
      });
    });
    expect(props.onResponse).toHaveBeenCalledOnce();
    expect(props.onResponse).toHaveBeenCalledWith({
      fileData: [attachment, { ...attachment, title: 'chart.pdf' }],
    });
    expect(remove.hasAttribute('disabled')).toBe(false);
  });

  it('blocks chart selection while a local upload is pending', async () => {
    let resolveRead!: (value: AttachmentAnswer) => void;
    mocks.readFile.mockReturnValue(
      new Promise<AttachmentAnswer>((resolve) => {
        resolveRead = resolve;
      })
    );
    const props = createProps();
    const { container } = render(<FileField {...props} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['local'], 'local.pdf')] },
    });
    const chart = screen.getByRole('button', { name: 'Choose from chart' });
    expect(chart.hasAttribute('disabled')).toBe(true);
    fireEvent.click(chart);
    expect(mocks.fetch).not.toHaveBeenCalled();

    await act(async () => resolveRead({ ...attachment, title: 'local.pdf' }));
    expect(props.onResponse).toHaveBeenCalledOnce();
    expect(chart.hasAttribute('disabled')).toBe(false);
  });
});
