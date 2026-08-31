import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ActivityEntry, FieldComponentProps } from '@esheet/core';
import { ActivityField, ACTIVITY_COLUMNS } from './ActivityField.js';

const captured = {
  props: null as Record<string, unknown> | null,
};
const sourceKeys: string[] = [];

vi.mock('@mieweb/ui/datavis', () => ({
  DataVisNitroContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
  DataVisNitroGrid: (props: Record<string, unknown>) => {
    captured.props = props;
    return (props.titleActions as ReactNode) ?? null;
  },
}));

vi.mock('datavis-ace', () => {
  class Source {
    cache: Record<string, unknown> = {};

    constructor(public readonly options: unknown) {
      const varName = (options as { varName?: unknown }).varName;
      if (typeof varName === 'string') sourceKeys.push(varName);
    }
  }

  class ComputedView {
    source: Source;

    constructor(source: Source) {
      this.source = source;
    }

    clearCache(): void {}

    getData(): void {}
  }

  return { ComputedView, Source };
});

function entry(
  id: string,
  at: string,
  overrides: Partial<ActivityEntry> = {}
): ActivityEntry {
  return {
    id,
    at,
    fieldId: 'status',
    question: 'Case status',
    from: 'Open',
    to: 'Closed',
    ...overrides,
  };
}

function createProps(activity: ActivityEntry[]): FieldComponentProps {
  const state = {
    instanceId: 'test',
    responses: { _activity: { activity } },
  };
  return {
    field: {
      definition: {
        fieldType: 'activity',
        id: 'log',
        question: 'Case activity',
      },
    },
    form: {
      getState: () => state,
      subscribe: () => () => undefined,
    },
    isPreview: true,
    isEnabled: true,
  } as unknown as FieldComponentProps;
}

function publishedRows(): Record<string, unknown>[] {
  const sourceKey = sourceKeys[0];
  return (
    window as unknown as Record<
      string,
      { readonly data: Record<string, unknown>[] }
    >
  )[sourceKey].data;
}

describe('ActivityField', () => {
  beforeEach(() => {
    captured.props = null;
    sourceKeys.length = 0;
  });

  it('publishes newest-first rows with the six activity columns', async () => {
    render(
      <ActivityField
        {...createProps([
          entry('older', '2026-01-01T10:00:00Z', { author: 'Alice' }),
          entry('newer', '2026-02-01T10:00:00Z', { author: 'Bob' }),
        ])}
      />
    );

    await waitFor(() => expect(captured.props).not.toBeNull());

    expect(ACTIVITY_COLUMNS.map((column) => column.header)).toEqual([
      'Date / Time',
      'Field',
      'Category',
      'Previous Value',
      'Current Value',
      'Author',
    ]);
    expect(publishedRows().map((row) => row.id)).toEqual(['newer', 'older']);
    expect(publishedRows()[0]).toMatchObject({
      field: 'Case status',
      category: 'Updated',
      from: 'Open',
      to: 'Closed',
      author: 'Bob',
    });

    const props = captured.props as {
      formatCell: (
        value: unknown,
        row: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    expect(
      props.formatCell(
        publishedRows()[0].at,
        publishedRows()[0],
        ACTIVITY_COLUMNS[0]
      )
    ).toBe(publishedRows()[0].atDisplay);
  });

  it('derives Added, Cleared, and Updated categories', async () => {
    render(
      <ActivityField
        {...createProps([
          entry('added', '2026-01-01T10:00:00Z', { from: undefined }),
          entry('cleared', '2026-01-02T10:00:00Z', { to: undefined }),
          entry('updated', '2026-01-03T10:00:00Z'),
        ])}
      />
    );

    await waitFor(() => expect(sourceKeys).toHaveLength(1));
    expect(
      Object.fromEntries(publishedRows().map((row) => [row.id, row.category]))
    ).toEqual({ added: 'Added', cleared: 'Cleared', updated: 'Updated' });
  });

  it('expands a highlighted before-and-after diff without edit controls', async () => {
    const previous = 'wha';
    const current = 'what';
    render(
      <ActivityField
        {...createProps([
          entry('changed', '2026-01-01T10:00:00Z', {
            from: previous,
            to: current,
          }),
        ])}
      />
    );

    const detailButton = await screen.findByRole('button', {
      name: 'Toggle all activity details',
    });
    fireEvent.click(detailButton);
    expect(detailButton.getAttribute('aria-pressed')).toBe('true');

    const props = captured.props as {
      renderDetailRow: (row: { data: Record<string, unknown> }) => ReactNode;
    };
    render(<>{props.renderDetailRow({ data: publishedRows()[0] })}</>);
    expect(document.querySelector('.activity-field__removed')).toBeNull();
    expect(document.querySelector('.activity-field__added')?.textContent).toBe(
      't'
    );
    expect(document.querySelector('.activity-field__previous')?.textContent).toContain(
      previous
    );
    expect(document.querySelector('.activity-field__current')?.textContent).toContain(
      current
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows an empty state when there is no activity', async () => {
    render(<ActivityField {...createProps([])} />);
    expect(await screen.findByText('No activity yet')).toBeTruthy();
  });
});
