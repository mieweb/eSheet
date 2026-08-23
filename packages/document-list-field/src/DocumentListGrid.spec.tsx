import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createFormStore, type FieldComponentProps } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import { DocumentListField } from './DocumentListField.js';
import {
  DocumentListFieldProvider,
  DocumentListGrid,
} from './DocumentListGrid.js';
import type { DocumentListDocument } from './types.js';
import { permissiveDocumentListCapabilities } from './types.js';

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
    sourceKeys.length = 0;
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
    expect(
      (captured.props as { titleActions: ReactNode }).titleActions
    ).toBeTruthy();

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

  it('uses package workflow defaults with a repository-only runtime', async () => {
    const formStore = createFormStore();    const customDetail = vi.fn(() => <div>Custom detail</div>);
    const repository = {
      load: vi.fn(async () => ({ documents: [row] })),
      save: vi.fn(
        async (_context: unknown, document: DocumentListDocument) => document
      ),
      remove: vi.fn(async () => undefined),
      loadContent: vi.fn(async () => ({ text: 'Loaded content' })),
    };
    const field = {
      definition: { id: 'documents', question: 'Documents' },
    } as unknown as FieldComponentProps['field'];
    const fieldProps = {
      field,
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            renderDetailRow: customDetail,
            capabilities: permissiveDocumentListCapabilities,
          }}
          runtime={{ repository }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Compose document' })
      ).toBeTruthy()
    );
    expect(
      screen.getByRole('button', { name: 'Upload document' })
    ).toBeTruthy();

    const props = captured.props as {
      renderDetailRow: (tableRow: {
        data: Record<string, unknown>;
      }) => ReactNode;
    };
    expect(props.renderDetailRow({ data: tableData })).toEqual(
      <div>Custom detail</div>
    );
    expect(customDetail).toHaveBeenCalledWith(row);
  });

  it('publishes an empty source for malformed field responses', async () => {
    const field = {
      definition: {
        question: 'Documents',
        documents: [row],
      },
    } as unknown as FieldComponentProps['field'];
    const props = {
      field,
      response: { answer: '{invalid' },
    } as unknown as FieldComponentProps;

    render(<DocumentListField {...props} />);

    await waitFor(() => expect(sourceKeys).toHaveLength(1));
    const sourceKey = sourceKeys[0];
    expect(
      (window as unknown as Record<string, { data: unknown[] }>)[sourceKey].data
    ).toEqual([]);
  });

  it('replaces published rows when the response becomes empty', async () => {
    const { rerender, unmount } = render(<DocumentListGrid rows={[row]} />);

    await waitFor(() => expect(sourceKeys).toHaveLength(1));
    const sourceKey = sourceKeys[0];
    const sources = window as unknown as Record<
      string,
      { data: DocumentListDocument[] }
    >;

    expect(sources[sourceKey].data).toEqual([row]);

    rerender(<DocumentListGrid rows={[]} />);

    await waitFor(() => expect(sources[sourceKey].data).toEqual([]));
    unmount();
    expect(sources[sourceKey]).toBeUndefined();
  });

  it('uses independent source keys for multiple field instances', async () => {
    const secondRow = { ...row, id: 'doc-2', title: 'Second letter' };

    const { unmount } = render(
      <>
        <DocumentListGrid rows={[row]} />
        <DocumentListGrid rows={[secondRow]} />
      </>
    );

    await waitFor(() => expect(sourceKeys).toHaveLength(2));
    expect(new Set(sourceKeys).size).toBe(2);

    const sources = window as unknown as Record<
      string,
      { data: DocumentListDocument[] }
    >;
    expect(sources[sourceKeys[0]].data).toEqual([row]);
    expect(sources[sourceKeys[1]].data).toEqual([secondRow]);

    unmount();
    expect(sources[sourceKeys[0]]).toBeUndefined();
    expect(sources[sourceKeys[1]]).toBeUndefined();
  });

  // ED.38 — the row says who is drafting it, without opening anything.
  it('badges a row with draft presence from the host channel', async () => {
    const formStore = createFormStore();
    const field = {
      definition: { id: 'documents', question: 'Documents', documents: [row] },
    } as unknown as FieldComponentProps['field'];
    const fieldProps = {
      field,
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;
    const draftChannel = {
      open: vi.fn(),
      presenceOf: vi.fn(
        (
          documentId: string,
          listener: (present: readonly unknown[]) => void
        ) => {
          if (documentId === 'doc-1') {
            listener([
              { user: { id: 'u-riley', name: 'Riley Reviewer' }, color: '#123456' },
            ]);
          }
          return () => {};
        }
      ),
    };

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
            draftChannel,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(draftChannel.presenceOf).toHaveBeenCalled());
    const props = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    const { container } = render(
      <>{props.formatCell('Letter', tableData, { field: 'title' })}</>
    );
    expect(
      container.querySelector('[aria-label="Draft in progress — Riley Reviewer"]')
    ).toBeTruthy();
    expect(
      (container.querySelector('.document-list-row-presence__dot') as HTMLElement)
        ?.style.backgroundColor
    ).toBeTruthy();
    // Other columns stay on the default rendering.
    expect(props.formatCell('42.pdf', tableData, { field: 'file' })).toBeUndefined();
  });
});
