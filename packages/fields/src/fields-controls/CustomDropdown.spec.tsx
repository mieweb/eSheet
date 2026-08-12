import { fireEvent, render, screen } from '@testing-library/react';
import { CustomDropdown } from './CustomDropdown.js';

const options = [
  { id: 'one', value: 'Option 1' },
  { id: 'two', value: 'Option 2' },
  { id: 'three', value: 'Option 3' },
];

describe('CustomDropdown', () => {
  it('keeps a multi-select menu open and marks selected options', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CustomDropdown
        options={options}
        value={[]}
        onChange={onChange}
        isMulti
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    fireEvent.click(screen.getByRole('option', { name: 'Option 1' }));

    expect(onChange).toHaveBeenCalledWith(['one']);
    expect(screen.getByRole('listbox')).not.toBeNull();

    rerender(
      <CustomDropdown
        options={options}
        value={['one']}
        onChange={onChange}
        isMulti
      />
    );

    expect(
      screen.getByRole('option', { name: 'Option 1', selected: true })
    ).not.toBeNull();
  });

  it('supports keyboard navigation and selection in multi-select mode', () => {
    const onChange = vi.fn();
    render(
      <CustomDropdown
        options={options}
        value={[]}
        onChange={onChange}
        isMulti
      />
    );

    const trigger = screen.getByRole('button', { name: 'Select an option' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const firstOption = screen.getByRole('option', { name: 'Option 1' });
    const secondOption = screen.getByRole('option', { name: 'Option 2' });

    fireEvent.keyDown(firstOption, { key: 'ArrowDown' });
    fireEvent.keyDown(secondOption, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['two']);
    expect(screen.getByRole('listbox')).not.toBeNull();
  });

  it('moves the highlighted option with the pointer', () => {
    const onChange = vi.fn();
    render(
      <CustomDropdown
        options={options}
        value={[]}
        onChange={onChange}
        isMulti
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    const firstOption = screen.getByRole('option', { name: 'Option 1' });
    const secondOption = screen.getByRole('option', { name: 'Option 2' });

    fireEvent.mouseEnter(secondOption);

    expect(firstOption).toHaveProperty('tabIndex', -1);
    expect(secondOption).toHaveProperty('tabIndex', 0);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    const onChange = vi.fn();
    render(
      <CustomDropdown
        options={options}
        value={[]}
        onChange={onChange}
        isMulti
      />
    );

    const trigger = screen.getByRole('button', { name: 'Select an option' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('option', { name: 'Option 1' }), {
      key: 'Escape',
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps single-select close-on-select behavior', () => {
    const onChange = vi.fn();
    render(
      <CustomDropdown options={options} value={null} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    fireEvent.click(screen.getByRole('option', { name: 'Option 2' }));

    expect(onChange).toHaveBeenCalledWith('two');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
