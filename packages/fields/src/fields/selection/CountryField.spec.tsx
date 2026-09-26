import { fireEvent, render } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import { CountryField, countryToSelection } from './CountryField.js';

const mocks = vi.hoisted(() => ({
  countryDropdown: vi.fn(() => null),
}));

vi.mock('@mieweb/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mieweb/ui')>()),
  CountryDropdown: mocks.countryDropdown,
}));

const US = { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' };

function createProps(
  overrides: Partial<FieldComponentProps> = {}
): FieldComponentProps {
  return {
    field: { definition: { fieldType: 'country', id: 'home-country' } },
    form: { getState: () => ({ instanceId: 'test' }) },
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
    onUpdate: vi.fn(),
    ...overrides,
  } as unknown as FieldComponentProps;
}

function dropdownProps() {
  return mocks.countryDropdown.mock.calls[0][0] as {
    value?: string;
    disabled?: boolean;
    onChange: (country: typeof US) => void;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('countryToSelection', () => {
  it('stores the ISO code as id and the name as value', () => {
    expect(countryToSelection(US)).toEqual({
      id: 'US',
      value: 'United States',
    });
  });
});

describe('CountryField', () => {
  it('stores the picked country as a dropdown-style selection', () => {
    const onResponse = vi.fn();
    render(<CountryField {...createProps({ onResponse })} />);

    dropdownProps().onChange(US);

    expect(onResponse).toHaveBeenCalledWith({
      selected: { id: 'US', value: 'United States' },
    });
  });

  it('passes the stored code back to the dropdown and honors isEnabled', () => {
    render(
      <CountryField
        {...createProps({
          response: { selected: { id: 'CA', value: 'Canada' } },
          isEnabled: false,
        })}
      />
    );

    expect(dropdownProps()).toMatchObject({ value: 'CA', disabled: true });
  });

  it('edits the question in builder mode', () => {
    const onUpdate = vi.fn();
    const { getByLabelText } = render(
      <CountryField {...createProps({ isPreview: false, onUpdate })} />
    );

    const input = getByLabelText('Question');
    fireEvent.change(input, { target: { value: 'Where do you live?' } });

    expect(onUpdate).toHaveBeenCalledWith({ question: 'Where do you live?' });
  });
});
