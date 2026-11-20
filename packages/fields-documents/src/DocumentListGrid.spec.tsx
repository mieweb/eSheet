import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { createFormStore, type FieldComponentProps } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import { DocumentListField } from './DocumentListField.js';
import {
  DocumentListFieldProvider,
  DocumentListGrid,
} from './DocumentListGrid.js';
import type { DocumentListDocument } from './types.js';
import { permissiveDocumentListCapabilities } from './types.js';
import { getDocumentListRuntimeState } from './document-list-runtime.js';

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
    // Like PlainTable, the rendered columns are set when the table mounts.
    const [columns] = useState(props.columns as readonly { header: string }[]);
    return (
      <>
        {props.titleActions as ReactNode}
        <table>
          <thead>
            <tr>
              {columns.map(({ header }) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
        </table>
      </>
    );
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

vi.mock('./DocumentListPdfPreview.js', () => ({
  DocumentListPdfViewer: () => <div role="region" aria-label="PDF viewer" />,
  DocumentListPdfPreview: ({
    document,
  }: {
    readonly document: { readonly title: string };
  }) => (
    <div role="dialog" aria-label={`Export document — ${document.title}`}>
      <div role="alert">Content unavailable</div>
    </div>
  ),
}));

const row: DocumentListDocument = {
  id: 'doc-1',
  date: '2026-08-18',
  title: 'Letter',
  subject: 'Subject',
  docType: 'Letter',
  docId: '42',
  source: 'WebChart',
  file: '42.pdf',
  // Published payloads default `rev` for the grid column.
  rev: 0,
};
const tableData: Record<string, unknown> = { ...row };

describe('DocumentListGrid host integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps linked addenda in the main grid without a form store', async () => {
    const addendum: DocumentListDocument = {
      ...row,
      id: 'addendum-1',
      linkedTo: { id: row.id, linkType: 'addendum' },
    };
    const props = {
      field: {
        definition: {
          id: 'caseNotes',
          question: 'Case notes',
          documents: [row, addendum],
        },
      },
    } as unknown as FieldComponentProps;

    render(
      <DocumentListFieldProvider host={{ showSubmissionMetadata: () => true }}>
        <DocumentListField {...props} />
      </DocumentListFieldProvider>
    );

    await waitFor(() => {
      const sourceKey = sourceKeys.at(-1);
      if (!sourceKey) throw new Error('Document grid source was not published');
      const source = (
        window as unknown as Record<string, { data: { id: string }[] }>
      )[sourceKey];
      expect(source?.data.map(({ id }) => id)).toEqual([row.id, addendum.id]);
    });
  });

  it('groups readable addenda under their original and preserves orphaned rows', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
    const getBounds = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        if (this.matches('.wcdv-td-detail-toggle button svg')) {
          return new DOMRect(this.closest('section') ? 66 : 19, 0, 16, 16);
        }
        if (
          this.matches(
            '.document-list-note-preview__body, .document-list-addenda-preview__content'
          )
        ) {
          return new DOMRect(48, 0, 1000, 24);
        }
        return getBounds.call(this);
      }
    );
    const submittedAt = '2026-08-19T00:05:06.000Z';
    const original = {
      ...row,
      rev: 2,
      nativeVersion: 'original-version',
      submittedAt,
      recordedAuthor: { id: 'original-author', name: 'Original author' },
      author: { id: 'editor', name: 'Latest editor' },
    };
    const addendum = {
      ...row,
      id: 'addendum-1',
      nativeVersion: 'addendum-version',
      linkedTo: { id: original.id, linkType: 'addendum' as const },
      submittedAt: '2026-08-20T01:00:00Z',
      recordedAuthor: { id: 'first', name: 'First addendum author' },
      author: { id: 'editor', name: 'Latest editor' },
    };
    const another = {
      ...addendum,
      id: 'addendum-2',
      submittedAt: '2026-08-21T01:00:00Z',
      recordedAuthor: { id: 'second', name: 'Second addendum author' },
    };
    const removed = {
      ...addendum,
      id: 'removed',
      removed: { reason: 'Removed' },
    };
    const hidden = { ...addendum, id: 'hidden' };
    const orphan = {
      ...addendum,
      id: 'orphan',
      submittedAt: undefined,
      linkedTo: { id: hidden.id, linkType: 'addendum' as const },
    };
    const nativeWithoutAddenda = {
      ...original,
      id: 'without-addenda',
      submittedAt: '2026-08-19T01:00:00+02:00',
    };
    const legacy = { ...row, id: 'legacy' };
    const invalid = { ...row, id: 'invalid', submittedAt: 'not a timestamp' };
    const repository = {
      load: async () => ({
        documents: [
          addendum,
          another,
          removed,
          hidden,
          orphan,
          legacy,
          invalid,
          nativeWithoutAddenda,
          original,
        ],
      }),
      loadContent: async (
        _context: unknown,
        document: DocumentListDocument
      ) => ({
        text: `Body of ${document.id}`,
      }),
      save: async (_context: unknown, document: DocumentListDocument) =>
        document,
      remove: async () => undefined,
    };
    const formStore = createFormStore();
    const props = {
      field: {
        definition: {
          id: 'caseNotes',
          question: 'Case notes',
          columns: ['date', 'docType', 'source', 'rev'],
        },
      },
      form: formStore,
    } as unknown as FieldComponentProps;
    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          runtime={{ repository }}
          host={{
            author: { id: 'editor', name: 'Latest editor' },
            capabilities: {
              ...permissiveDocumentListCapabilities,
              view: (doc) => doc.id !== hidden.id,
            },
            showSubmissionMetadata: (fieldId) => fieldId === 'caseNotes',
            documentHref: (doc) => `#/document/${doc.id}`,
          }}
        >
          <DocumentListField {...props} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );
    const getRows = () =>
      (
        window as unknown as Record<string, { data: Record<string, unknown>[] }>
      )[sourceKeys.at(-1)!]?.data;
    await waitFor(() =>
      expect(getRows()?.map((doc) => doc.id)).toEqual([
        original.id,
        nativeWithoutAddenda.id,
        orphan.id,
        legacy.id,
        invalid.id,
      ])
    );
    const [main, , , unverified] = getRows();
    expect(main).toMatchObject({
      submissionDate: submittedAt,
      submissionTime: submittedAt,
      submissionAuthor: 'Original author',
    });
    expect(unverified.submissionAuthor).toBe('—');
    type GridProps = {
      columns: readonly { header: string; className?: string }[];
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
      renderDetailRow: (row: { data: Record<string, unknown> }) => ReactNode;
    };
    const grid = captured.props as GridProps;
    const headers = grid.columns.map(({ header }) => header);
    expect(headers).toEqual(['Date', 'Time', 'Author', 'Rev', 'Actions']);
    const detail = render(
      <>
        {grid.formatCell(main.submissionDate, main, {
          field: 'submissionDate',
        })}
        {grid.formatCell(main.submissionTime, main, {
          field: 'submissionTime',
        })}
        {grid.formatCell(unverified.submissionDate, unverified, {
          field: 'submissionDate',
        })}
        <table>
          <tbody>
            <tr>
              <td className="wcdv-td-detail-toggle">
                <button type="button" aria-label="Toggle note">
                  <svg aria-hidden="true" />
                </button>
              </td>
              {grid.columns.map(({ header, className }, index) => (
                <td
                  key={header}
                  className={className}
                  ref={(cell) => {
                    if (cell) {
                      cell.getBoundingClientRect = () =>
                        new DOMRect(0, 0, [320, 260, 440, 60, 100][index], 24);
                    }
                  }}
                />
              ))}
            </tr>
            <tr className="wcdv-detail-tr">
              <td className="wcdv-detail-td" colSpan={6}>
                {grid.renderDetailRow({ data: main })}
              </td>
            </tr>
          </tbody>
        </table>
      </>
    );
    const panel = detail.getByRole('region', { name: 'Addenda' });
    const preview = panel.closest<HTMLElement>('.document-list-detail')!;
    expect(
      preview.style.getPropertyValue('--document-list-outer-date-width')
    ).toBe('320px');
    expect(
      preview.style.getPropertyValue('--document-list-outer-time-width')
    ).toBe('260px');
    expect(
      preview.style.getPropertyValue('--document-list-outer-author-width')
    ).toBe('440px');
    const addenda = within(panel);
    const body = await detail.findByText('Body of doc-1');
    const contentRow = body.parentElement;
    expect(contentRow?.nextElementSibling).toBe(panel);
    const addendumBody = await addenda.findByText('Body of addendum-1');
    expect(
      contentRow?.style.getPropertyValue('--document-list-elbow-start')
    ).toBe('-21.5px');
    expect(
      addendumBody
        .closest<HTMLElement>('.document-list-addenda-preview__content')
        ?.style.getPropertyValue('--document-list-elbow-start')
    ).toBe('25.5px');
    expect(addenda.getByText('Body of addendum-2')).toBeTruthy();
    expect(addenda.queryByText('Body of removed')).toBeNull();
    expect(addenda.queryByText('Latest editor')).toBeNull();
    expect(addenda.getByRole('grid')).toBeTruthy();
    const heading = addenda.getByRole('heading', { name: 'Addenda' });
    expect(heading.compareDocumentPosition(addenda.getByRole('grid'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      addenda.queryByRole('button', {
        name: /grid actions|toggle all document details/i,
      })
    ).toBeNull();
    expect(addenda.getByText('Date')).toBeTruthy();
    expect(
      addenda.queryByRole('link', { name: /Revision history/ })
    ).toBeNull();
    const [toggleAll, newer, older] = addenda.getAllByRole('button', {
      expanded: true,
    });
    expect(newer.closest('tr')?.textContent).toContain(
      'Second addendum author'
    );
    expect(older.closest('tr')?.textContent).toContain('First addendum author');
    expect(toggleAll.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(addenda.getByText('Second addendum author'));
    expect(newer.getAttribute('aria-expanded')).toBe('false');
    expect(older.getAttribute('aria-expanded')).toBe('true');
    expect(addenda.queryByText('Body of addendum-2')).toBeNull();
    expect(toggleAll.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggleAll);
    expect(newer.getAttribute('aria-expanded')).toBe('true');
    expect(older.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggleAll);
    expect(newer.getAttribute('aria-expanded')).toBe('false');
    expect(older.getAttribute('aria-expanded')).toBe('false');
    expect(addenda.queryByText(/Body of addendum-/)).toBeNull();
    expect(body.closest('[hidden]')).toBeNull();
    const history = detail.getByRole('link', {
      name: 'Revision history (rev 2)',
    });
    expect(history.getAttribute('href')).toBe('#/document/doc-1');
    expect(panel.compareDocumentPosition(history)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      Array.from(
        detail.container.querySelectorAll('time'),
        (node) => node.dateTime
      )
    ).toEqual([
      submittedAt,
      submittedAt,
      another.submittedAt,
      another.submittedAt,
      addendum.submittedAt,
      addendum.submittedAt,
    ]);
  });

  it('keeps title-less presence badges regional without mutating document dates', async () => {
    const languages = vi
      .spyOn(navigator, 'languages', 'get')
      .mockReturnValue(['en-GB']);
    try {
      const formStore = createFormStore();
      const props = {
        field: {
          definition: {
            id: 'notes',
            question: 'Notes',
            columns: ['date', 'subject'],
            documents: [row],
          },
        },
        form: formStore,
      } as unknown as FieldComponentProps;
      render(
        <FormStoreContext.Provider value={formStore}>
          <DocumentListFieldProvider
            host={{
              capabilities: permissiveDocumentListCapabilities,
              draftChannel: {
                open: vi.fn(),
                presenceOf: (_id, listener) => {
                  listener([{ user: { id: 'other', name: 'Other author' } }]);
                  return () => {};
                },
              },
            }}
          >
            <DocumentListField {...props} />
          </DocumentListFieldProvider>
        </FormStoreContext.Provider>
      );
      await waitFor(() => expect(captured.props).not.toBeNull());
      const grid = captured.props as {
        formatCell: (
          value: unknown,
          data: Record<string, unknown>,
          column: { field: string }
        ) => ReactNode;
      };
      render(<>{grid.formatCell(row.date, tableData, { field: 'date' })}</>);
      expect(screen.getByText('18/08/2026')).toBeTruthy();
      expect(
        screen.getByRole('img', { name: 'Draft in progress — Other author' })
      ).toBeTruthy();
      expect(row.date).toBe('2026-08-18');
    } finally {
      languages.mockRestore();
    }
  });

  it('preserves host-provided date cell formatting', async () => {
    const formatCell = vi.fn(() => 'Host date');
    render(<DocumentListGrid rows={[row]} formatCell={formatCell} />);
    await waitFor(() => expect(captured.props).not.toBeNull());
    const grid = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    expect(grid.formatCell(row.date, tableData, { field: 'date' })).toBe(
      'Host date'
    );
    expect(formatCell).toHaveBeenCalledWith(row.date, tableData, {
      field: 'date',
    });
  });

  it('formats dates regionally without changing source rows or requiring actions', async () => {
    const languages = vi
      .spyOn(navigator, 'languages', 'get')
      .mockReturnValue(['en-GB']);
    try {
      render(<DocumentListGrid rows={[row]} />);
      await waitFor(() => expect(captured.props).not.toBeNull());
      const props = captured.props as {
        formatCell: (
          value: unknown,
          data: Record<string, unknown>,
          column: { field: string }
        ) => ReactNode;
      };
      render(<>{props.formatCell(row.date, tableData, { field: 'date' })}</>);
      expect(screen.getByText('18/08/2026')).toBeTruthy();
      expect(row.date).toBe('2026-08-18');
    } finally {
      languages.mockRestore();
    }
  });

  beforeEach(() => {
    captured.props = null;
    sourceKeys.length = 0;
  });

  it('uses the WebChart display classification as the grid field while actions retain the MIME subtype', async () => {
    const native = {
      ...row,
      docType: 'application/pdf',
      nativeDocType: 'NOTE',
      nativeDocTypeLabel: 'Clinical note',
    };
    const actionRenderer = vi.fn(() => null);
    const formatCell = vi.fn(() => undefined);
    render(
      <DocumentListGrid
        rows={[native]}
        renderActions={actionRenderer}
        formatCell={formatCell}
      />
    );
    await waitFor(() => expect(captured.props).not.toBeNull());
    const props = captured.props as {
      columns: readonly { field: string; header: string }[];
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    expect(
      props.columns.find((column) => column.header === 'Document Type')?.field
    ).toBe('documentType');
    const projected = { ...native, documentType: 'Clinical note' };
    expect(
      props.formatCell('Clinical note', projected, { field: 'documentType' })
    ).toBe('Clinical note');
    expect(formatCell).toHaveBeenCalledWith('Clinical note', projected, {
      field: 'docType',
    });
    props.formatCell(undefined, projected, { field: '_actions' });
    expect(actionRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        docType: 'application/pdf',
        nativeDocType: 'NOTE',
        nativeDocTypeLabel: 'Clinical note',
      }),
      expect.any(Object)
    );
  });

  it.each([undefined, ['date', 'title', 'file']])(
    'omits the filename column, including from legacy definitions (%j)',
    async (columns) => {
      const formStore = createFormStore();
      const fieldProps = {
        field: {
          definition: {
            id: 'caseDocuments',
            question: 'Documents',
            documents: [row],
            columns,
          },
        },
        form: formStore,
      } as unknown as FieldComponentProps;
      render(
        <FormStoreContext.Provider value={formStore}>
          <DocumentListField {...fieldProps} />
        </FormStoreContext.Provider>
      );
      await waitFor(() => expect(captured.props).not.toBeNull());
      const fields = (
        captured.props as { columns: readonly { field: string }[] }
      ).columns.map((column) => column.field);
      expect(fields).toContain('title');
      expect(fields).not.toContain('file');
      if (columns) expect(fields).toEqual(['date', 'title']);
    }
  );

  it.each(['caseNotes', 'letterLog', 'caseDocuments'])(
    'records each successful %s detail opening, including cached reopens',
    async (fieldId) => {
      const formStore = createFormStore();
      formStore.getState().loadDefinition({
        id: 'case',
        pages: [
          {
            id: 'page',
            fields: [
              { id: fieldId, fieldType: 'text', question: 'Document list' },
              { id: 'log', fieldType: 'activity', question: 'Activity' },
            ],
          },
        ],
      });
      formStore.getState().setIdentity({ name: 'Case Viewer' });
      const repository = {
        load: vi.fn(async () => ({ documents: [row] })),
        loadContent: vi.fn(async () => ({
          text: 'Private document prose',
          ...(fieldId === 'caseDocuments'
            ? {
                contentType: 'application/pdf',
                blob: new Blob([], { type: 'application/pdf' }),
              }
            : {}),
        })),
        save: vi.fn(
          async (_context: unknown, document: DocumentListDocument) => document
        ),
        remove: vi.fn(async () => undefined),
      };
      const props = {
        field: { definition: { id: fieldId, question: 'Document list' } },
        form: formStore,
      } as unknown as FieldComponentProps;
      render(
        <FormStoreContext.Provider value={formStore}>
          <DocumentListFieldProvider
            host={{
              capabilities: permissiveDocumentListCapabilities,
              alignDetailPreview: (id) =>
                id === 'letterLog' || id === 'caseDocuments',
            }}
            runtime={{ repository }}
          >
            <DocumentListField {...props} />
          </DocumentListFieldProvider>
        </FormStoreContext.Provider>
      );
      await waitFor(() =>
        expect(
          getDocumentListRuntimeState(formStore, fieldId)?.documents[row.id]
        ).toBeTruthy()
      );
      expect(
        formStore.getState().responses._activity?.activity
      ).toBeUndefined();
      const grid = captured.props as {
        renderDetailRow: (tableRow: {
          data: Record<string, unknown>;
        }) => ReactNode;
      };
      const first = render(<>{grid.renderDetailRow({ data: tableData })}</>);
      const prose = await first.findByText('Private document prose');
      const alignedBody = prose.closest('.document-list-note-preview__body');
      if (fieldId === 'caseNotes') {
        expect(alignedBody).toBeNull();
      } else {
        expect(alignedBody).not.toBeNull();
        expect(first.queryByRole('region', { name: 'Addenda' })).toBeNull();
      }
      if (fieldId === 'caseDocuments') {
        const viewer = await first.findByRole('region', { name: 'PDF viewer' });
        expect(viewer.closest('.document-list-note-preview__body')).toBe(
          alignedBody
        );
      }
      expect(formStore.getState().responses._activity?.activity).toEqual([
        expect.objectContaining({
          fieldId,
          question: 'Document list',
          category: 'Viewed',
          author: 'Case Viewer',
          to: 'Letter (doc-1), rev 0',
          at: expect.any(String),
        }),
      ]);
      first.rerender(<>{grid.renderDetailRow({ data: tableData })}</>);
      expect(formStore.getState().responses._activity?.activity).toHaveLength(
        1
      );
      first.unmount();
      const reopened = render(<>{grid.renderDetailRow({ data: tableData })}</>);
      expect(await screen.findByText('Private document prose')).toBeTruthy();
      expect(formStore.getState().responses._activity?.activity).toHaveLength(
        2
      );
      expect(repository.loadContent).toHaveBeenCalledOnce();
      expect(
        JSON.stringify(formStore.getState().responses._activity)
      ).not.toContain('Private document prose');
      reopened.unmount();
    }
  );

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

  it('omits host row actions while the form is read-only', async () => {
    const formStore = createFormStore();
    const actionRenderer = vi.fn(() => <button type="button">Remove</button>);
    const capabilities = {
      ...permissiveDocumentListCapabilities,
      view: vi.fn(() => false),
    };
    const fieldProps = {
      field: {
        definition: {
          id: 'documents',
          question: 'Documents',
          documents: [row],
        },
      },
      form: formStore,
      isReadOnly: true,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities,
            renderActions: actionRenderer,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());

    const props = captured.props as {
      columns: readonly { field: string }[];
    };
    expect(capabilities.view).toHaveBeenCalledWith(row);
    expect(
      (window as unknown as Record<string, { data: unknown[] }>)[sourceKeys[0]]
        .data
    ).toEqual([]);
    expect(props.columns.map((column) => column.field)).not.toContain(
      '_actions'
    );
    expect(actionRenderer).not.toHaveBeenCalled();
  });

  it('shows Actions without reopening the tab when edit access resolves', async () => {
    const formStore = createFormStore();
    const props = {
      field: { definition: { id: 'caseNotes', documents: [row] } },
      form: formStore,
    } as unknown as FieldComponentProps;
    const host = {
      capabilities: permissiveDocumentListCapabilities,
      author: { id: 'author', name: 'Author' },
      showSubmissionMetadata: () => true,
    };
    const tab = (isReadOnly: boolean) => (
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider host={host}>
          <DocumentListField {...props} isReadOnly={isReadOnly} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );
    const { rerender } = render(tab(true));
    await screen.findByRole('columnheader', { name: 'Author' });
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();

    rerender(tab(false));
    await screen.findByRole('columnheader', { name: 'Actions' });

    rerender(tab(true));
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
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
    const formStore = createFormStore();
    const customDetail = vi.fn(() => <div>Custom detail</div>);
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

  it('opens document export when enabled', async () => {
    const formStore = createFormStore();
    formStore.getState().loadDefinition({
      id: 'case',
      pages: [
        {
          id: 'letters-page',
          fields: [
            { id: 'letterLog', fieldType: 'text', question: 'Letters' },
            { id: 'activityLog', fieldType: 'activity', question: 'Activity' },
          ],
        },
      ],
    });
    const onDownloadPdf = vi.fn(async () => true);
    const fieldProps = {
      field: {
        definition: {
          id: 'letterLog',
          question: 'Letters',
          documents: [row],
          actions: ['downloadPdf'],
        },
      },
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
            onDownloadPdf,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());
    const props = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    render(
      <>{props.formatCell(undefined, tableData, { field: '_actions' })}</>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export Letter' }));

    expect(
      screen.getByRole('dialog', { name: 'Export document — Letter' })
    ).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onDownloadPdf).not.toHaveBeenCalled();
  });

  it('omits Print when the definition does not enable it', async () => {
    const formStore = createFormStore();
    const fieldProps = {
      field: {
        definition: { id: 'letterLog', question: 'Letters', documents: [row] },
      },
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());
    expect(
      (captured.props as { columns: readonly { field: string }[] }).columns.map(
        (column) => column.field
      )
    ).not.toContain('_actions');
  });

  it('does not let host row capabilities bypass the PDF definition opt-in', async () => {
    const formStore = createFormStore();
    const fieldProps = {
      field: {
        definition: { id: 'letterLog', question: 'Letters', documents: [row] },
      },
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
            author: { id: 'u-casey', name: 'Casey Manager' },
            getRowCapabilities: () => ({
              canView: true,
              canCompose: true,
              canEdit: true,
              canAppend: true,
              canRequestSignature: false,
              canDelete: true,
              canDownloadPdf: true,
            }),
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());
    const props = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    render(
      <>{props.formatCell(undefined, tableData, { field: '_actions' })}</>
    );
    expect(screen.queryByRole('button', { name: 'Export Letter' })).toBeNull();
  });

  it('keeps Print available while the form is read-only', async () => {
    const formStore = createFormStore();
    const fieldProps = {
      field: {
        definition: {
          id: 'letterLog',
          question: 'Letters',
          documents: [row],
          actions: ['downloadPdf'],
        },
      },
      form: formStore,
      isReadOnly: true,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{
            capabilities: permissiveDocumentListCapabilities,
          }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    await waitFor(() => expect(captured.props).not.toBeNull());
    const props = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    render(
      <>{props.formatCell(undefined, tableData, { field: '_actions' })}</>
    );
    expect(screen.getByRole('button', { name: 'Export Letter' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Letter' })).toBeNull();
  });

  it('keeps PDF export available for a visible removed row', async () => {
    const removedRow: DocumentListDocument = {
      ...row,
      removed: { at: '2026-10-02T10:00:00.000Z', reason: 'Duplicate' },
    };
    const formStore = createFormStore();
    const fieldProps = {
      field: {
        definition: {
          id: 'letterLog',
          question: 'Letters',
          documents: [removedRow],
          actions: ['downloadPdf'],
        },
      },
      form: formStore,
      isReadOnly: true,
      response: undefined,
    } as unknown as FieldComponentProps;

    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{ capabilities: permissiveDocumentListCapabilities }}
        >
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Show removed (1)' })
    );
    await waitFor(() => expect(captured.props).not.toBeNull());
    const props = captured.props as {
      formatCell: (
        value: unknown,
        data: Record<string, unknown>,
        column: { field: string }
      ) => ReactNode;
    };
    render(
      <>
        {props.formatCell(undefined, { ...removedRow }, { field: '_actions' })}
      </>
    );
    expect(screen.getByRole('button', { name: 'Export Letter' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restore Letter' })).toBeNull();
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

    expect(sources[sourceKey].data).toEqual([
      { ...row, documentType: row.docType },
    ]);

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
    expect(sources[sourceKeys[0]].data).toEqual([
      { ...row, documentType: row.docType },
    ]);
    expect(sources[sourceKeys[1]].data).toEqual([
      { ...secondRow, documentType: secondRow.docType },
    ]);

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
              {
                user: { id: 'u-casey', name: 'Casey Manager' },
                color: '#654321',
              },
              {
                user: { id: 'stale-casey-session', name: 'Casey Manager' },
                color: '#abcdef',
              },
              {
                user: { id: 'u-riley', name: 'Riley Reviewer' },
                color: '#123456',
              },
              {
                user: { id: 'u-riley', name: 'Riley Reviewer' },
                color: '#fedcba',
              },
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
            author: { id: 'u-casey', name: 'Casey Manager' },
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
      container.querySelector(
        '[aria-label="Draft in progress — Casey Manager, Riley Reviewer"]'
      )
    ).toBeTruthy();
    expect(
      container.querySelectorAll('.document-list-row-presence__dot')
    ).toHaveLength(2);
    expect(
      (
        container.querySelector(
          '.document-list-row-presence__dot'
        ) as HTMLElement
      )?.style.backgroundColor
    ).toBeTruthy();
    // Other columns render their own value — datavis has no undefined
    // fallback, so the wrapper must supply the cell content itself.
    expect(props.formatCell('42.pdf', tableData, { field: 'file' })).toBe(
      '42.pdf'
    );
  });
});
