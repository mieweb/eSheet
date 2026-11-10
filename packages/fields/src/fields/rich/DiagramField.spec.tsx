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
  it('clears respondent backgrounds and suppresses their placeholder', () => {
    const props = createProps();
    render(
      <DiagramField
        {...props}
        response={{ markupBackground: 'data:image/png;base64,background' }}
      />
    );

    expect(padProps().placeholder).toBe('');
    act(() => padProps().onChange?.({ strokes: '', image: '' }));
    expect(props.onResponse).toHaveBeenCalledWith({
      markupData: '',
      markupImage: '',
      markupBackground: undefined,
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
      markupImage: 'data:image/png;base64,local',
      markupData: '',
    });
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
    });
  });
});
