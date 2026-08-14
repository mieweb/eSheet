import { render, screen } from '@testing-library/react';
import type { ActivityEntry, FieldComponentProps } from '@esheet/core';
import { ActivityField } from './ActivityField.js';

const entry = (
  id: string,
  at: string,
  overrides: Partial<ActivityEntry> = {}
): ActivityEntry => ({
  id,
  at,
  fieldId: 'status',
  question: 'Case status',
  from: 'Open',
  to: 'Closed',
  ...overrides,
});

function createProps(
  activity: ActivityEntry[],
  overrides: Partial<FieldComponentProps> = {}
): FieldComponentProps {
  const state = {
    instanceId: 'test',
    responses: { _activity: { activity } },
  };
  return {
    field: { definition: { fieldType: 'activity', id: 'log' } },
    form: {
      getState: () => state,
      subscribe: () => () => undefined,
    },
    isPreview: true,
    isEnabled: true,
    ...overrides,
  } as unknown as FieldComponentProps;
}

describe('ActivityField', () => {
  it('renders change entries newest first', () => {
    render(
      <ActivityField
        {...createProps([
          entry('e1', '2026-01-01T10:00:00Z', {
            author: 'Alice',
            to: 'In progress',
          }),
          entry('e2', '2026-02-01T10:00:00Z', { author: 'Bob' }),
        ])}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Bob');
    expect(items[0].textContent).toContain('Case status');
    expect(items[0].textContent).toContain('Open');
    expect(items[0].textContent).toContain('Closed');
    expect(items[1].textContent).toContain('Alice');
  });

  it('is immutable — no buttons or inputs in the DOM', () => {
    const { container } = render(
      <ActivityField {...createProps([entry('e1', '2026-01-01T10:00:00Z')])} />
    );
    expect(container.querySelectorAll('button, input, textarea')).toHaveLength(
      0
    );
  });

  it('shows an empty state when there is no activity', () => {
    render(<ActivityField {...createProps([])} />);
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });
});
