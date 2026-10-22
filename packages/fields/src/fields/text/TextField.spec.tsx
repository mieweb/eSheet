import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import { TextField } from './TextField.js';
import { LongTextField } from './LongTextField.js';

const mocks = vi.hoisted(() => ({
  dateInput: vi.fn((..._args: unknown[]) => null),
}));

vi.mock('@mieweb/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mieweb/ui')>()),
  DateInput: mocks.dateInput,
}));

function createProps(definition: Record<string, unknown>): FieldComponentProps {
  return {
    field: { definition },
    form: { getState: () => ({ instanceId: 'test' }) },
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
  } as unknown as FieldComponentProps;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('TextField', () => {
  it('stores DateInput values as ISO dates', () => {
    const onResponse = vi.fn();

    render(
      <TextField
        {...createProps({
          fieldType: 'text',
          id: 'appointment-date',
          inputType: 'date',
        })}
        onResponse={onResponse}
      />
    );

    const props = mocks.dateInput.mock.calls[0][0] as {
      onChange: (value: string) => void;
    };
    props.onChange('07/15/2026');

    expect(onResponse).toHaveBeenCalledWith({ answer: '2026-07-15' });
  });

  it('formats stored ISO dates for DateInput', () => {
    render(
      <TextField
        {...createProps({
          fieldType: 'text',
          id: 'appointment-date',
          inputType: 'date',
        })}
        response={{ answer: '2026-07-15' }}
      />
    );

    expect(mocks.dateInput).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '07/15/2026',
        name: 'esheet-date-answer-appointment-date',
      }),
      undefined
    );
  });

  it('resolves relative date bounds when the field is rendered', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28));

    render(
      <TextField
        {...createProps({
          fieldType: 'text',
          id: 'appointment-date',
          inputType: 'date',
          dateRange: { amount: 2, unit: 'years' },
        })}
      />
    );

    expect(mocks.dateInput).toHaveBeenCalledWith(
      expect.objectContaining({
        minDate: '07/28/2024',
        maxDate: '07/28/2028',
      }),
      undefined
    );

    vi.useRealTimers();
  });

  it('renders Date and Time fields with DateInput', () => {
    render(
      <TextField
        {...createProps({
          fieldType: 'text',
          id: 'appointment-date-time',
          inputType: 'datetime-local',
          timeFormat: '12-hour',
        })}
      />
    );

    expect(mocks.dateInput).toHaveBeenCalledWith(
      expect.objectContaining({
        inputType: 'datetime-local',
        timeFormat: '12-hour',
        validateOnBlur: true,
        name: 'esheet-datetime-local-answer-appointment-date-time',
      }),
      undefined
    );
  });
});

describe('LongTextField', () => {
  const definition = {
    fieldType: 'longtext',
    id: 'notes',
    question: 'Additional notes',
  };

  it('uses the shared single-line auto-growing default without a height cap', () => {
    render(<LongTextField {...createProps(definition)} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(1);
    expect(textarea.dataset.autoResize).toBe('true');
    expect(textarea.className).not.toContain('max-h-');
    expect(textarea.style.maxHeight).toBe('');
    expect(textarea.id).toBe('test-longtext-answer-notes');
  });

  it('passes saved and programmatically updated answers to the shared textarea', () => {
    const props = createProps(definition);
    const { rerender } = render(
      <LongTextField {...props} response={{ answer: 'First\nSecond' }} />
    );

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'First\nSecond'
    );

    rerender(<LongTextField {...props} response={{ answer: '' }} />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('stores multiline edits without changing the answer format', () => {
    const onResponse = vi.fn();
    render(
      <LongTextField {...createProps(definition)} onResponse={onResponse} />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'First\nSecond' },
    });

    expect(onResponse).toHaveBeenCalledWith({ answer: 'First\nSecond' });
  });

  it.each([true, false])(
    'applies and clears the maximum row cap in preview mode %s',
    (isPreview) => {
      const props = createProps({ ...definition, rows: 2, maxRows: 5 });
      const { rerender } = render(
        <LongTextField
          {...props}
          isPreview={isPreview}
          response={{ answer: 'Saved\nanswer' }}
        />
      );
      const label = isPreview ? 'Additional notes' : 'Answer preview';
      const textarea = screen.getByLabelText(label) as HTMLTextAreaElement;
      expect(textarea.rows).toBe(2);
      expect(textarea.style.maxHeight).toContain('5lh');
      expect(textarea.style.maxHeight).toContain('--esheet-textarea-padding-y');
      expect(textarea.style.overflowY).toBe('auto');

      rerender(
        <LongTextField
          {...createProps({ ...definition, rows: 2, maxRows: 3 })}
          isPreview={isPreview}
          response={{ answer: 'Saved\nanswer' }}
        />
      );
      expect(screen.getByLabelText(label)).not.toBe(textarea);
      expect(
        (screen.getByLabelText(label) as HTMLTextAreaElement).style.maxHeight
      ).toContain('3lh');

      rerender(
        <LongTextField
          {...createProps(definition)}
          isPreview={isPreview}
          response={{ answer: 'Saved\nanswer' }}
        />
      );
      const uncapped = screen.getByLabelText(label) as HTMLTextAreaElement;
      expect(uncapped.style.maxHeight).toBe('');
      expect(uncapped.style.overflowY).toBe('');
      if (isPreview) expect(uncapped.value).toBe('Saved\nanswer');
    }
  );

  it.each([true, false])(
    'honors explicit rows in preview mode %s',
    (isPreview) => {
      const { rerender } = render(
        <LongTextField
          {...createProps({ ...definition, rows: 5 })}
          isPreview={isPreview}
        />
      );
      const label = isPreview ? 'Additional notes' : 'Answer preview';
      const textarea = screen.getByLabelText(label) as HTMLTextAreaElement;
      expect(textarea.rows).toBe(5);
      expect(textarea.dataset.autoResize).toBe('true');

      rerender(
        <LongTextField {...createProps(definition)} isPreview={isPreview} />
      );
      expect(screen.getByLabelText(label)).not.toBe(textarea);
      expect((screen.getByLabelText(label) as HTMLTextAreaElement).rows).toBe(
        1
      );
    }
  );
});
