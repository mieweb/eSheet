import { fireEvent, render, screen } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import { SectionField } from './SectionField.js';

function createProps(definition: Record<string, unknown>): FieldComponentProps {
  return {
    field: { definition },
    form: { getState: () => ({ instanceId: 'test' }) },
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
  } as unknown as FieldComponentProps;
}

describe('SectionField', () => {
  it('renders an expanded collapsible section when configured', () => {
    render(
      <SectionField
        {...createProps({
          id: 'details',
          fieldType: 'section',
          title: 'Details',
          sectionCollapse: 'expanded',
        })}
        nestedChildren={<div>Child field</div>}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Collapse Details' })
    ).toBeTruthy();
    expect(screen.queryByText('Child field')).not.toBeNull();
  });

  it('renders the configured Lucide icon and expanded indicator', () => {
    const { container } = render(
      <SectionField
        {...createProps({
          id: 'details',
          fieldType: 'section',
          title: 'Details',
          sectionIcon: 'file',
          sectionCollapse: 'expanded',
        })}
        nestedChildren={<div>Child field</div>}
      />
    );

    const button = screen.getByRole('button', {
      name: 'Collapse Details',
    });

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBeTruthy();
    expect(screen.queryByText('Child field')).not.toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('toggles nested children and the indicator between expanded and collapsed', () => {
    const { container } = render(
      <SectionField
        {...createProps({
          id: 'details',
          fieldType: 'section',
          title: 'Details',
          sectionCollapse: 'collapsed',
        })}
        nestedChildren={<div>Child field</div>}
      />
    );

    const button = screen.getByRole('button', {
      name: 'Expand Details',
    });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Child field')).toBeNull();
    expect(button.querySelector('svg')).not.toBeNull();

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByText('Child field')).not.toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps disabled sections expanded without a collapse button', () => {
    render(
      <SectionField
        {...createProps({
          id: 'details',
          fieldType: 'section',
          title: 'Details',
          sectionIcon: 'info',
          sectionCollapse: 'disabled',
        })}
        nestedChildren={<div>Child field</div>}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Child field')).not.toBeNull();
  });
});
