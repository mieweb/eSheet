import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type ContextType,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Button, formatRegionalDate, regionalDateLocale } from '@mieweb/ui';
import { DataVisNitroContext, DataVisNitroGrid } from '@mieweb/ui/datavis';
import { ComputedView, Source } from 'datavis-ace';
import { LayoutList, SquarePen, Upload } from 'lucide-react';
import { ComposerSessionProvider } from './ComposerSession.js';
import {
  createLocalSourcePayload,
  DOCUMENT_LIST_ACTIONS_COLUMN,
  DOCUMENT_LIST_COLUMNS,
  DOCUMENT_LIST_DEFAULT_NOUN,
  normalizeDocumentRow,
  SUBMISSION_COLUMNS,
} from './data.js';
import type { FieldProvider } from '@esheet/fields';
import { FormStoreContext } from '@esheet/fields';
import type { FileStore } from '@esheet/core';
import {
  createDocumentListRuntimeExtension,
  type DocumentListRepository,
  type DocumentListRuntimeState,
} from './document-list-runtime.js';
import type {
  DocumentListAuthor,
  DocumentListCapabilities,
  DocumentListDocument,
} from './types.js';
import type { DocumentDraftChannel } from './draftChannel.js';

type DataVisGridProps = Partial<ComponentProps<typeof DataVisNitroGrid>>;
type DataVisView = ContextType<typeof DataVisNitroContext>;
const NamedComputedView = ComputedView as unknown as new (
  source: Source,
  options: { readonly name: string }
) => ComputedView;
const OptionalDataVisNitroGrid =
  DataVisNitroGrid as unknown as ComponentType<DataVisGridProps>;

export type DocumentListColumn =
  | (typeof DOCUMENT_LIST_COLUMNS)[number]
  | (typeof SUBMISSION_COLUMNS)[number]
  | typeof DOCUMENT_LIST_ACTIONS_COLUMN;

export interface DocumentListRowCapabilities {
  readonly canView: boolean;
  readonly canCompose: boolean;
  readonly canEdit: boolean;
  readonly canAppend: boolean;
  readonly canRequestSignature: boolean;
  readonly canDelete: boolean;
  readonly canDownloadPdf: boolean;
}

export type DocumentListActionsRenderer = (
  row: DocumentListDocument,
  capabilities: DocumentListRowCapabilities
) => ReactNode;

export type DocumentListFieldAction = (
  runtime: DocumentListRuntimeState
) => void | Promise<void>;

export type DocumentListPrintAction = (
  document: DocumentListDocument,
  runtime: DocumentListRuntimeState
) => boolean | Promise<boolean>;

export interface DocumentListFieldRuntimeOptions {
  readonly formInstanceId?: string;
  readonly repository?: DocumentListRepository;
  readonly fileStore?: FileStore;
}

interface DocumentListRuntimeContextValue {
  readonly options: DocumentListFieldRuntimeOptions;
  readonly registerField: (fieldId: string) => void;
}

export interface DocumentListToolbarProps {
  detailRowsExpanded?: boolean;
  onToggleDetails?: () => void;
  onCompose?: () => void;
  onUpload?: () => void;
}

export interface DocumentListGridProps extends DocumentListToolbarProps {
  rows: readonly DocumentListDocument[];
  title?: string;
  /** What one row is called, lowercase; defaults to `document`. */
  noun?: string;
  columns?: readonly DocumentListColumn[];
  titleActions?: ReactNode;
  renderActions?: DocumentListActionsRenderer;
  getRowCapabilities?: (
    row: DocumentListDocument
  ) => DocumentListRowCapabilities;
  formatCell?: DataVisGridProps['formatCell'];
  submissionMetadata?: boolean;
  onRowClick?: (row: DocumentListDocument, event: MouseEvent) => void;
  onRowDoubleClick?: (row: DocumentListDocument, event: MouseEvent) => void;
  renderDetailRow?: (row: DocumentListDocument) => ReactNode;
  loading?: boolean;
  error?: ReactNode;
  style?: DataVisGridProps['style'];
}

export type DocumentListFieldHost = Pick<
  DocumentListGridProps,
  | 'titleActions'
  | 'renderActions'
  | 'getRowCapabilities'
  | 'onRowClick'
  | 'onRowDoubleClick'
  | 'renderDetailRow'
  | 'detailRowsExpanded'
  | 'onToggleDetails'
  | 'loading'
  | 'error'
> & {
  readonly onCompose?: DocumentListFieldAction;
  readonly registerComposeAction?: (
    fieldId: string,
    compose: (() => void) | undefined
  ) => () => void;
  readonly onComposeDirtyChange?: (dirty: boolean) => void;
  readonly onUpload?: DocumentListFieldAction;
  /** @deprecated PDF preview is handled natively by DocumentListField. */
  readonly onDownloadPdf?: DocumentListPrintAction;
  /**
   * Who may do what, resolved by the host — the field never sees roles,
   * levels or a grant table. Rows the object cannot `view` are hidden and
   * compose/upload appear only for types it can `create`. **Absent means
   * read-only** (the migration default: saying nothing must never widen
   * access); a demo with nobody to protect passes
   * `permissiveDocumentListCapabilities` explicitly.
   */
  readonly capabilities?: DocumentListCapabilities;
  /**
   * Who this window is, stamped as `author` onto rows the composer and
   * uploader save. Absent means rows are saved unattributed — and an
   * unattributed row is nobody's own.
   */
  readonly author?: DocumentListAuthor;
  /**
   * Where proposed changes live (ED.36). Host-supplied — this package never
   * imports Yjs — and optional: without one, editing an existing document is
   * not offered and compose stays the single-user flow it is today.
   */
  readonly draftChannel?: DocumentDraftChannel;
  /**
   * Renders a doc type's body template with the answers its mergeContext
   * names (ED.33). Host-supplied — the field never depends on a template
   * engine — and loaded lazily by the host, never in its entry chunk.
   */
  readonly renderTemplate?: (
    template: string,
    mergeContext: Readonly<Record<string, string>>
  ) => Promise<string>;
  /**
   * A deep URL for one document — the host's full-page view with the
   * revision history. The detail row links there instead of inlining the
   * revisions; absent means no link.
   */
  readonly documentHref?: (
    document: DocumentListDocument
  ) => string | null | undefined;
  readonly showSubmissionMetadata?: (fieldId: string) => boolean;
};

const DocumentListFieldHostContext =
  createContext<DocumentListFieldHost | null>(null);

const DocumentListRuntimeContext =
  createContext<DocumentListRuntimeContextValue | null>(null);

export interface DocumentListFieldProviderProps {
  readonly host: DocumentListFieldHost;
  readonly runtime?: DocumentListFieldRuntimeOptions;
  readonly children: ReactNode;
}

export function DocumentListFieldProvider({
  host,
  children,
  runtime,
}: DocumentListFieldProviderProps): React.JSX.Element {
  const formStore = useContext(FormStoreContext);
  const fieldIdsRef = useRef(new Set<string>());
  const runtimeContext = useMemo<DocumentListRuntimeContextValue>(
    () => ({
      options: runtime ?? {},
      registerField: (fieldId) => fieldIdsRef.current.add(fieldId),
    }),
    [runtime]
  );

  useEffect(
    () => () => {
      if (!formStore) return;
      formStore.getState().clearExtensionsForFields([...fieldIdsRef.current]);
      fieldIdsRef.current.clear();
    },
    [formStore]
  );

  return (
    <DocumentListFieldHostContext.Provider value={host}>
      <DocumentListRuntimeContext.Provider value={runtimeContext}>
        <ComposerSessionProvider onDirtyChange={host.onComposeDirtyChange}>
          {children}
        </ComposerSessionProvider>
      </DocumentListRuntimeContext.Provider>
    </DocumentListFieldHostContext.Provider>
  );
}

export function createDocumentListFieldProvider(
  host: DocumentListFieldHost,
  runtime?: DocumentListFieldRuntimeOptions
): FieldProvider {
  return (children) => (
    <DocumentListFieldProvider host={host} runtime={runtime}>
      {children}
    </DocumentListFieldProvider>
  );
}

export function useDocumentListFieldHost(): DocumentListFieldHost | null {
  return useContext(DocumentListFieldHostContext);
}

export function useDocumentListFieldRuntime(
  fieldId: string,
  initialDocuments?: readonly DocumentListDocument[],
  onDocumentsChange?: (documents: readonly DocumentListDocument[]) => void
): DocumentListRuntimeState | null {
  const formStore = useContext(FormStoreContext);
  const runtime = useContext(DocumentListRuntimeContext);
  const onDocumentsChangeRef = useRef(onDocumentsChange);
  const [runtimeState, setRuntimeState] =
    useState<DocumentListRuntimeState | null>(null);
  onDocumentsChangeRef.current = onDocumentsChange;
  useEffect(() => {
    runtime?.registerField(fieldId);
    if (!formStore) {
      setRuntimeState(null);
      return;
    }
    const formInstanceId =
      formStore.getState().instanceId ??
      runtime?.options.formInstanceId ??
      'document-list-provider';
    setRuntimeState(
      createDocumentListRuntimeExtension({
        formStore,
        context: { formInstanceId, fieldId },
        repository: runtime?.options.repository,
        fileStore: runtime?.options.fileStore,
        initialDocuments,
        // The extension outlives any one render, so the callback stays behind
        // a ref rather than being captured at creation.
        onDocumentsChange: (documents) =>
          onDocumentsChangeRef.current?.(documents),
      }) ?? null
    );
  }, [fieldId, formStore, initialDocuments, runtime]);
  return runtimeState;
}

const DEFAULT_ROW_CAPABILITIES: DocumentListRowCapabilities = {
  canView: true,
  canCompose: true,
  canEdit: true,
  canAppend: true,
  canRequestSignature: true,
  canDelete: true,
  canDownloadPdf: false,
};

interface DataVisTableRow {
  data: Record<string, unknown>;
}

function documentFromTableRow(
  row: DataVisTableRow
): DocumentListDocument | null {
  return normalizeDocumentRow(row.data);
}

let nextSourceId = 0;

function createSourceKey(): string {
  nextSourceId += 1;
  return `__esheet_document_list_${nextSourceId}`;
}

function publishRows(
  sourceKey: string,
  payload: ReturnType<typeof createLocalSourcePayload>
): void {
  const windowRecord = window as unknown as Record<string, unknown>;
  windowRecord[sourceKey] = payload;
}

function refreshView(view: ComputedView): void {
  const source = view.source as unknown as { cache?: Record<string, unknown> };
  source.cache = {};
  view.clearCache();
  view.getData();
}

function useDocumentListView(
  payload: ReturnType<typeof createLocalSourcePayload>
): {
  sourceKey: string;
  view: DataVisView;
} {
  const sourceKey = useRef<string | null>(null);
  const viewRef = useRef<ComputedView | null>(null);
  const [view, setView] = useState<DataVisView>(null);

  if (sourceKey.current === null) sourceKey.current = createSourceKey();

  useEffect(() => {
    if (typeof window === 'undefined' || sourceKey.current === null) return;

    const key = sourceKey.current;
    publishRows(key, payload);
    const nextView = new NamedComputedView(
      new Source({ type: 'local', varName: key }, undefined, undefined, {
        name: `DocumentListSource:${key}`,
      }),
      { name: `DocumentListView:${key}` }
    );
    viewRef.current = nextView;
    setView(nextView as unknown as DataVisView);

    return () => {
      delete (window as unknown as Record<string, unknown>)[key];
      viewRef.current = null;
      setView(null);
    };
    // The source is intentionally created once per mounted field instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || sourceKey.current === null) return;

    const key = sourceKey.current;
    publishRows(key, payload);
    const refreshTimer = window.setTimeout(() => {
      if (viewRef.current) refreshView(viewRef.current);
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [payload]);

  return { sourceKey: sourceKey.current, view };
}

export function DocumentListGrid({
  rows,
  title = 'Documents',
  noun = DOCUMENT_LIST_DEFAULT_NOUN,
  columns = DOCUMENT_LIST_COLUMNS,
  titleActions,
  renderActions,
  getRowCapabilities,
  formatCell,
  submissionMetadata,
  onRowClick,
  onRowDoubleClick,
  renderDetailRow,
  detailRowsExpanded,
  onToggleDetails,
  onCompose,
  onUpload,
  loading = false,
  error,
  style,
}: DocumentListGridProps): React.JSX.Element {
  const payload = useMemo(
    () => createLocalSourcePayload(rows, submissionMetadata),
    [rows, submissionMetadata]
  );
  const { view } = useDocumentListView(payload);
  const gridColumns = useMemo(() => {
    const displayed = columns.map((column) =>
      column.field === 'docType' ? { ...column, field: 'documentType' } : column
    );
    return renderActions
      ? columns.some(
          (column) => column.field === DOCUMENT_LIST_ACTIONS_COLUMN.field
        )
        ? displayed
        : [...displayed, DOCUMENT_LIST_ACTIONS_COLUMN]
      : displayed;
  }, [columns, renderActions]);
  const gridFormatCell = useMemo<DataVisGridProps['formatCell']>(
    () => (value, row, column) => {
      const document = normalizeDocumentRow(row);
      if (
        column.field === DOCUMENT_LIST_ACTIONS_COLUMN.field &&
        document &&
        renderActions
      ) {
        return renderActions(
          document,
          getRowCapabilities?.(document) ?? DEFAULT_ROW_CAPABILITIES
        );
      }
      const formatted = formatCell?.(
        value,
        row,
        column.field === 'documentType'
          ? { ...column, field: 'docType' }
          : column
      );
      if (formatted !== undefined) return formatted;
      // datavis renders exactly what formatCell returns — undefined is a
      // blank cell, not a fallback — so plain cells return their value.
      const text = value == null ? '' : String(value);
      if (
        column.field === 'submissionDate' ||
        column.field === 'submissionTime'
      ) {
        const instant = new Date(text);
        if (!Number.isFinite(instant.getTime())) return '—';
        const locale = regionalDateLocale();
        return (
          <time dateTime={text} className="document-list-grid__nowrap">
            {column.field === 'submissionDate'
              ? instant.toLocaleDateString(locale, {
                  calendar: 'gregory',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })
              : instant.toLocaleTimeString(locale)}
          </time>
        );
      }
      // An ISO date must never break on its hyphens.
      return column.field === 'date' ? (
        <span className="document-list-grid__nowrap">
          {formatRegionalDate(text)}
        </span>
      ) : (
        text
      );
    },
    [formatCell, getRowCapabilities, renderActions]
  );
  const gridOnRowClick = useMemo<DataVisGridProps['onRowClick']>(
    () =>
      onRowClick
        ? (row, event) => {
            const document = documentFromTableRow(row);
            if (document) onRowClick(document, event);
          }
        : undefined,
    [onRowClick]
  );
  const gridOnRowDoubleClick = useMemo<DataVisGridProps['onRowDoubleClick']>(
    () =>
      onRowDoubleClick
        ? (row, event) => {
            const document = documentFromTableRow(row);
            if (document) onRowDoubleClick(document, event);
          }
        : undefined,
    [onRowDoubleClick]
  );
  const gridRenderDetailRow = useMemo<DataVisGridProps['renderDetailRow']>(
    () =>
      renderDetailRow
        ? (row) => {
            const document = documentFromTableRow(row);
            return document ? renderDetailRow(document) : null;
          }
        : undefined,
    [renderDetailRow]
  );
  const gridTitleActions = useMemo(
    () =>
      titleActions || onToggleDetails || onCompose || onUpload ? (
        <div className="document-list-grid__title-actions">
          {onToggleDetails && (
            <Button
              type="button"
              variant={detailRowsExpanded ? 'primary' : 'ghost'}
              size="sm"
              onClick={onToggleDetails}
              aria-label="Toggle all document details"
              aria-pressed={detailRowsExpanded ?? false}
              title="Detail"
              leftIcon={<LayoutList size={16} aria-hidden="true" />}
            >
              <span className="document-list-grid__action-label">Detail</span>
            </Button>
          )}
          {onCompose && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={onCompose}
              aria-label={`Compose ${noun}`}
              title="Compose"
              leftIcon={<SquarePen size={16} aria-hidden="true" />}
            >
              <span className="document-list-grid__action-label">Compose</span>
            </Button>
          )}
          {onUpload && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={onUpload}
              aria-label={`Upload ${noun}`}
              title="Upload"
              leftIcon={<Upload size={16} aria-hidden="true" />}
            >
              <span className="document-list-grid__action-label">Upload</span>
            </Button>
          )}
          {titleActions}
        </div>
      ) : undefined,
    [
      detailRowsExpanded,
      noun,
      onCompose,
      onToggleDetails,
      onUpload,
      titleActions,
    ]
  );
  const gridStyle = useMemo(() => ({ width: '100%', ...style }), [style]);

  if (!view) {
    return (
      <div
        className="document-list-grid document-list-grid--loading"
        role="status"
      >
        Loading documents…
      </div>
    );
  }

  return (
    <DataVisNitroContext.Provider value={view}>
      <div className="document-list-grid">
        {loading && (
          <div className="document-list-grid__status" role="status">
            Loading documents…
          </div>
        )}
        {error && (
          <div className="document-list-grid__error" role="alert">
            {error}
          </div>
        )}
        <OptionalDataVisNitroGrid
          // PlainTable initializes its column state at mount. Reinitialize it
          // when access changes the schema, not when rows or actions update.
          key={JSON.stringify(gridColumns.map(({ field }) => field))}
          title={title}
          titleActions={gridTitleActions}
          columns={gridColumns as DataVisGridProps['columns']}
          formatCell={gridFormatCell}
          onRowClick={gridOnRowClick}
          onRowDoubleClick={gridOnRowDoubleClick}
          renderDetailRow={gridRenderDetailRow}
          detailRowsExpanded={detailRowsExpanded}
          style={gridStyle}
        />
      </div>
    </DataVisNitroContext.Provider>
  );
}
