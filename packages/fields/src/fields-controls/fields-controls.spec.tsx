import { fireEvent, render, screen } from '@testing-library/react';
import { CustomCheckboxButton } from './CustomCheckboxButton.js';
import { CustomRadioButton } from './CustomRadioButton.js';

describe('field selection buttons', () => {
  it('selects and deselects a radio button', () => {
    const onSelect = vi.fn();
    const onUnselect = vi.fn();
    const { rerender } = render(
      <CustomRadioButton
        id="radio-option"
        name="radio"
        value="option"
        checked={false}
        onSelect={onSelect}
        onUnselect={onUnselect}
      >
        Option
      </CustomRadioButton>
    );

    const radio = screen.getByRole('radio', { name: 'Option' });
    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalledWith('option');

    rerender(
      <CustomRadioButton
        id="radio-option"
        name="radio"
        value="option"
        checked
        onSelect={onSelect}
        onUnselect={onUnselect}
      >
        Option
      </CustomRadioButton>
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Option' }));
    expect(onUnselect).toHaveBeenCalledWith('option');
  });

  it('toggles a checkbox button and ignores disabled clicks', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CustomCheckboxButton
        id="check-option"
        value="option"
        checked={false}
        onChange={onChange}
      >
        Option
      </CustomCheckboxButton>
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Option' }));
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(
      <CustomCheckboxButton
        id="check-option"
        value="option"
        checked
        onChange={onChange}
      >
        Option
      </CustomCheckboxButton>
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Option' }));
    expect(onChange).toHaveBeenLastCalledWith(false);

    rerender(
      <CustomCheckboxButton
        id="check-option"
        value="option"
        checked={false}
        disabled
        onChange={onChange}
      >
        Option
      </CustomCheckboxButton>
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Option' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
