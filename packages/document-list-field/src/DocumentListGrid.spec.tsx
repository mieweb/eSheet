import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DocumentListGrid } from './DocumentListGrid.js';
import type { DocumentListDocument } from './types.js';

const captured = {
  props: null as Record<string, unknown> | null,
};

vi.mock('@mieweb/ui/datavis', () => ({
  DataVisNitroContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
  DataVisNitroGrid: (props: Record<string, unknown>) => {
    captured.props = props;
    return null;
  },
}));

vi.mock('datavis-ace', () => {
  class Source {
    cache: Record<string, unknown> = {};

    constructor(public readonly options: unknown) {}
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

const row: DocumentListDocument = {
  id: 'doc-1',
  date: '2026-08-18',
  title: 'Letter',
  subject: 'Subject',
  docType: 'Letter',
  docId: '42',
  source: 'WebChart',
  file: '42.pdf',
};
const tableData: Record<string, unknown> = { ...row };

describe('DocumentListGrid host integration', () => {
  beforeEach(() => {
    captured.props = null;
  });

  it('adds the Actions column and renders host actions for a stable row', async () => {
    const actionRenderer = vi.fn(() => <button type="button">View</button>);

    render(<DocumentListGrid rows={[row]} renderActions={actionRenderer} />);

    await waitFor(() => expect(captured.props).not.toBeNull());

    const props = captured.props as {
      columns: readonly { field: string }[];
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    expect(props.columns.map((column) => column.field)).toContain('_actions');
    expect(
      props.formatCell(undefined, tableData, { field: '_actions' })
    ).toBeTruthy();
    expect(actionRenderer).toHaveBeenCalledWith(
      row,
      expect.objectContaining({ canView: true, canDelete: true })
    );
  });

  it('maps DataVis row events and detail rows to document summaries', async () => {
    const onRowClick = vi.fn();
    const onRowDoubleClick = vi.fn();
    const renderDetailRow = vi.fn(() => <div>Detail</div>);

    render(
      <DocumentListGrid
        rows={[row]}
        onRowClick={onRowClick}
        onRowDoubleClick={onRowDoubleClick}
        renderDetailRow={renderDetailRow}
      />
    );

    await waitFor(() => expect(captured.props).not.toBeNull());

    const props = captured.props as {
      onRowClick: (
        tableRow: { data: Record<string, unknown> },
        event: unknown
      ) => void;
      onRowDoubleClick: (
        tableRow: { data: Record<string, unknown> },
        event: unknown
      ) => void;
      renderDetailRow: (tableRow: {
        data: Record<string, unknown>;
      }) => ReactNode;
    };
    const event = {};
    props.onRowClick({ data: tableData }, event);
    props.onRowDoubleClick({ data: tableData }, event);
    props.renderDetailRow({ data: tableData });

    expect(onRowClick).toHaveBeenCalledWith(row, event);
    expect(onRowDoubleClick).toHaveBeenCalledWith(row, event);
    expect(renderDetailRow).toHaveBeenCalledWith(row);
  });

  it('renders standard toolbar controls and dispatches host callbacks', async () => {
    const onToggleDetails = vi.fn();
    const onCompose = vi.fn();
    const onUpload = vi.fn();

    const { rerender } = render(
      <DocumentListGrid
        rows={[row]}
        detailRowsExpanded={false}
        onToggleDetails={onToggleDetails}
        onCompose={onCompose}
        onUpload={onUpload}
        titleActions={<button type="button">Custom action</button>}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Toggle all document details' })
      ).toBeTruthy()
    );

    const detailButton = screen.getByRole('button', {
      name: 'Toggle all document details',
    });
    expect(detailButton.getAttribute('aria-pressed')).toBe('false');
    expect(
      screen.getByRole('button', { name: 'Compose document' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Upload document' })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeTruthy();

    fireEvent.click(detailButton);
    fireEvent.click(screen.getByRole('button', { name: 'Compose document' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(onToggleDetails).toHaveBeenCalledOnce();
    expect(onCompose).toHaveBeenCalledOnce();
    expect(onUpload).toHaveBeenCalledOnce();

    rerender(
      <DocumentListGrid
        rows={[row]}
        detailRowsExpanded
        onToggleDetails={onToggleDetails}
        onCompose={onCompose}
        onUpload={onUpload}
      />
    );

    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Toggle all document details' })
          .getAttribute('aria-pressed')
      ).toBe('true')
    );
  });
});
