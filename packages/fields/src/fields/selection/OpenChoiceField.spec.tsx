import { fireEvent, render, screen } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import { OpenChoiceField } from './OpenChoiceField.js';

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

const definition = {
  fieldType: 'openchoice',
  id: 'choice',
  question: 'Choose an option',
  options: [
    { id: 'one', value: 'Option 1' },
    { id: 'two', value: 'Option 2' },
  ],
};

describe('OpenChoiceField', () => {
  it('uses button-style radio options and mounts Other input on selection', () => {
    const onResponse = vi.fn();
    const { rerender } = render(
      <OpenChoiceField {...createProps(definition)} onResponse={onResponse} />
    );

    expect(screen.getByRole('radio', { name: 'Option 1' })).not.toBeNull();
    expect(
      screen.queryByRole('textbox', { name: 'Other, please Specify:' })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('radio', { name: 'Other, please Specify:' })
    );
    expect(onResponse).toHaveBeenCalledWith({
      selected: { id: 'choice-other', value: '' },
    });

    rerender(
      <OpenChoiceField
        {...createProps(definition)}
        response={{ selected: { id: 'choice-other', value: '' } }}
        onResponse={onResponse}
      />
    );

    const otherInput = screen.getByRole('textbox', {
      name: 'Other, please Specify:',
    });
    fireEvent.change(otherInput, { target: { value: 'Custom answer' } });
    expect(onResponse).toHaveBeenLastCalledWith({
      selected: { id: 'choice-other', value: 'Custom answer' },
    });
  });

  it('deselects the selected option when clicked again', () => {
    const onResponse = vi.fn();

    render(
      <OpenChoiceField
        {...createProps(definition)}
        response={{ selected: { id: 'one', value: 'Option 1' } }}
        onResponse={onResponse}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Option 1' }));
    expect(onResponse).toHaveBeenCalledWith({ selected: undefined });
  });
});
