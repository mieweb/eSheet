import { render } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import { TextField } from './TextField.js';

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
    form: {
      getState: () => ({ instanceId: 'test' }),
      subscribe: () => () => {},
    },
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
  } as unknown as FieldComponentProps;
}

beforeEach(() => {
  vi.clearAllMocks();
});

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
