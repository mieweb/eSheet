import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { FieldComponentProps, FileInput } from '@esheet/core';
import { DiagramField } from './DiagramField.js';
import { DrawingPad } from './DrawingPad.js';
import { DocumentPickerDialog } from '../../lib/DocumentPickerDialog.js';

const mocks = vi.hoisted(() => ({
  pad: vi.fn(() => null),
  dialog: vi.fn(() => null),
  fetch: vi.fn(),
  readImage: vi.fn(),
}));

vi.mock('./DrawingPad.js', () => ({ DrawingPad: mocks.pad }));
vi.mock('../../lib/DocumentPickerDialog.js', () => ({
  DocumentPickerDialog: mocks.dialog,
}));
vi.mock('../../lib/DocumentPickerProvider.js', () => ({
  useDocumentPicker: () => ({ fetch: mocks.fetch }),
}));
vi.mock('../../lib/file-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/file-utils.js')>()),
  readImageAsDataUrl: mocks.readImage,
}));

function createProps(): FieldComponentProps {
  return {
    field: { definition: { id: 'diagram', fieldType: 'diagram' } },
    form: { getState: () => ({ instanceId: 'test' }) },
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
  } as unknown as FieldComponentProps;
}

function padProps() {
  return vi.mocked(DrawingPad).mock.calls.at(-1)![0] as ComponentProps<
    typeof DrawingPad
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readImage.mockResolvedValue('data:image/png;base64,local');
});

afterEach(cleanup);

describe('DiagramField attachments', () => {
  it('opens the image input from the floating upload action', () => {
    render(<DiagramField {...createProps()} />);
    const input = screen.getByLabelText('Attach image file');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});

    act(() => padProps().onAttachFile?.());

    expect(click).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Attach file' })).toBeNull();
    click.mockRestore();
  });

  it('defaults the builder toggle to enabled and saves explicit choices', () => {
    const props = { ...createProps(), isPreview: false, onUpdate: vi.fn() };
    const { rerender } = render(<DiagramField {...props} />);
    const toggle = screen.getByRole('checkbox', {
      name: 'Allow image attachments in renderer',
    });

    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    expect(props.onUpdate).toHaveBeenLastCalledWith({
      allowImageAttachments: false,
    });

    rerender(
      <DiagramField
        {...props}
        field={{
          ...props.field,
          definition: {
            id: 'diagram',
            fieldType: 'diagram',
            allowImageAttachments: false,
          },
        }}
      />
    );
    expect((toggle as HTMLInputElement).checked).toBe(false);
    expect(screen.getByLabelText('Upload background image')).toBeTruthy();
    fireEvent.click(toggle);
    expect(props.onUpdate).toHaveBeenLastCalledWith({
      allowImageAttachments: true,
    });
  });

  it.each([
    { allowImageAttachments: false, isEnabled: true, isReadOnly: false },
    { allowImageAttachments: true, isEnabled: false, isReadOnly: false },
    { allowImageAttachments: true, isEnabled: true, isReadOnly: true },
  ])(
    'hides attachments and blocks stale picker callbacks with %o',
    ({ allowImageAttachments, isEnabled, isReadOnly }) => {
      const props = createProps();
      const { rerender } = render(<DiagramField {...props} />);
      fireEvent.click(screen.getByText('Choose from chart'));
      const dialog = vi.mocked(DocumentPickerDialog).mock.calls.at(-1)![0];

      rerender(
        <DiagramField
          {...props}
          isEnabled={isEnabled}
          isReadOnly={isReadOnly}
          field={{
            ...props.field,
            definition: {
              id: 'diagram',
              fieldType: 'diagram',
              allowImageAttachments,
            },
          }}
          response={{ markupBackground: 'saved.png' }}
        />
      );

      expect(screen.queryByLabelText('Attach image file')).toBeNull();
      expect(screen.queryByText('Choose from chart')).toBeNull();
      expect(screen.queryByText('Remove image')).toBeNull();
      expect(padProps().onAttachFile).toBeUndefined();
      expect(padProps().backgroundImage).toBe('saved.png');
      act(() => dialog.onSelect({ id: 'chart', title: 'Chart image' }));
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.readImage).not.toHaveBeenCalled();
      expect(props.onResponse).not.toHaveBeenCalled();
    }
  );

  it('invalidates a pending chart fetch when attachments are turned off', async () => {
    let resolveFetch!: (input: FileInput) => void;
    mocks.fetch.mockReturnValue(
      new Promise<FileInput>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const props = createProps();
    const { rerender } = render(<DiagramField {...props} />);
    fireEvent.click(screen.getByText('Choose from chart'));
    act(() => {
      const dialog = vi.mocked(DocumentPickerDialog).mock.calls.at(-1)![0];
      dialog.onSelect({ id: 'chart', title: 'Chart image' });
    });

    rerender(
      <DiagramField
        {...props}
        field={{
          ...props.field,
          definition: {
            id: 'diagram',
            fieldType: 'diagram',
            allowImageAttachments: false,
          },
        }}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<DiagramField {...props} />);
    await act(async () => {
      resolveFetch({
        content: new Blob(['chart']),
        contentType: 'image/png',
      });
    });

    expect(mocks.readImage).not.toHaveBeenCalled();
    expect(props.onResponse).not.toHaveBeenCalled();
  });

  it('invalidates pending local image decoding when attachments are turned off', async () => {
    let resolveImage!: (value: string) => void;
    mocks.readImage.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveImage = resolve;
      })
    );
    const props = createProps();
    const { rerender } = render(<DiagramField {...props} />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Attach image file'), {
        target: { files: [new File(['local'], 'local.png')] },
      });
    });

    rerender(
      <DiagramField
        {...props}
        field={{
          ...props.field,
          definition: {
            id: 'diagram',
            fieldType: 'diagram',
            allowImageAttachments: false,
          },
        }}
      />
    );
    await act(async () => resolveImage('data:image/png;base64,stale'));

    expect(props.onResponse).not.toHaveBeenCalled();
  });

  it('clears respondent backgrounds and suppresses their placeholder', () => {
    const props = createProps();
    render(
      <DiagramField
        {...props}
        response={{ markupBackground: 'data:image/png;base64,background' }}
      />
    );

    expect(padProps().placeholder).toBe('');
    expect(padProps().attachmentName).toBe('Attached image');
    act(() => padProps().onChange?.({ strokes: '', image: '' }));
    expect(props.onResponse).toHaveBeenCalledWith({
      markupData: '',
      markupImage: '',
      markupBackground: undefined,
      markupBackgroundTitle: undefined,
    });
  });

  it('does not replace a newer local image with a pending chart fetch', async () => {
    let resolveFetch!: (input: FileInput) => void;
    mocks.fetch.mockReturnValue(
      new Promise<FileInput>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const props = createProps();
    render(<DiagramField {...props} />);

    fireEvent.click(screen.getByText('Choose from chart'));
    act(() => {
      const dialog = vi.mocked(DocumentPickerDialog).mock.calls.at(-1)![0];
      dialog.onSelect({ id: 'chart', title: 'Chart image' });
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Attach image file'), {
        target: { files: [new File(['local'], 'local.png')] },
      });
    });
    expect(props.onResponse).toHaveBeenCalledOnce();

    await act(async () => {
      resolveFetch({
        content: new Blob(['chart']),
        contentType: 'image/png',
      });
    });
    expect(props.onResponse).toHaveBeenCalledOnce();
    expect(props.onResponse).toHaveBeenCalledWith({
      markupBackground: 'data:image/png;base64,local',
      markupBackgroundTitle: 'local.png',
      markupImage: 'data:image/png;base64,local',
      markupData: JSON.stringify({
        strokes: [],
        baseWidth: 640,
        baseHeight: 400,
      }),
    });
  });

  it('keeps an image-only answer populated when the same image is reattached', async () => {
    const props = createProps();
    render(
      <DiagramField
        {...props}
        response={{
          markupBackground: 'data:image/png;base64,local',
          markupData: JSON.stringify({
            strokes: [],
            baseWidth: 640,
            baseHeight: 400,
          }),
        }}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Attach image file'), {
        target: { files: [new File(['local'], 'local.png')] },
      });
    });

    expect(props.onResponse).toHaveBeenCalledWith({
      markupBackground: 'data:image/png;base64,local',
      markupBackgroundTitle: 'local.png',
      markupImage: 'data:image/png;base64,local',
      markupData: JSON.stringify({
        strokes: [],
        baseWidth: 640,
        baseHeight: 400,
      }),
    });
  });

  it.each([undefined, 'download.png'])(
    'saves the host image title, using the listed title when missing: %s',
    async (title) => {
      mocks.fetch.mockResolvedValue({
        content: new Blob(['chart']),
        contentType: 'image/png',
        title,
      });
      const props = createProps();
      render(<DiagramField {...props} />);

      fireEvent.click(screen.getByText('Choose from chart'));
      await act(async () => {
        const dialog = vi.mocked(DocumentPickerDialog).mock.calls.at(-1)![0];
        dialog.onSelect({ id: 'chart', title: 'Chart image.png' });
      });

      expect(props.onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          markupBackgroundTitle: title ?? 'Chart image.png',
        })
      );
    }
  );

  it('preserves the saved filename when drawing on the image', () => {
    const props = createProps();
    render(
      <DiagramField
        {...props}
        response={{
          markupBackground: 'saved.png',
          markupBackgroundTitle: 'Patient diagram.png',
        }}
      />
    );

    expect(padProps().attachmentName).toBe('Patient diagram.png');
    act(() =>
      padProps().onChange?.({ strokes: 'strokes', image: 'composite.png' })
    );

    expect(props.onResponse).toHaveBeenCalledWith({
      markupData: 'strokes',
      markupImage: 'composite.png',
      markupBackground: 'saved.png',
      markupBackgroundTitle: 'Patient diagram.png',
    });
  });

  it('removes an image-only attachment and restores the authored background', () => {
    const defaults = createProps();
    const props: FieldComponentProps = {
      ...defaults,
      field: {
        ...defaults.field,
        definition: {
          id: 'diagram',
          fieldType: 'diagram',
          imageUri: 'authored.png',
        },
      },
    };
    const { rerender } = render(
      <DiagramField
        {...props}
        response={{
          markupBackground: 'data:image/png;base64,local',
          markupBackgroundTitle: 'local.png',
        }}
      />
    );

    expect(padProps().attachmentName).toBe('local.png');
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull();
    act(() => padProps().onChange?.({ strokes: '', image: '' }));
    expect(props.onResponse).toHaveBeenCalledWith({
      markupData: '',
      markupImage: '',
      markupBackground: undefined,
      markupBackgroundTitle: undefined,
    });

    rerender(<DiagramField {...props} response={{}} />);
    expect(padProps().backgroundImage).toBe('authored.png');
    expect(padProps().attachmentName).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull();
  });

  it('ignores pending image decoding after Clear', async () => {
    let resolveImage!: (value: string) => void;
    mocks.readImage.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveImage = resolve;
      })
    );
    const props = createProps();
    render(<DiagramField {...props} />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Attach image file'), {
        target: { files: [new File(['local'], 'local.png')] },
      });
    });
    act(() => padProps().onChange?.({ strokes: '', image: '' }));
    await act(async () => resolveImage('data:image/png;base64,stale'));

    expect(props.onResponse).toHaveBeenCalledOnce();
    expect(props.onResponse).toHaveBeenCalledWith({
      markupData: '',
      markupImage: '',
      markupBackground: undefined,
      markupBackgroundTitle: undefined,
    });
  });
});
