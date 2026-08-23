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
import { Button } from '@mieweb/ui';
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
} from './data.js';
import type { FieldProvider } from '@esheet/fields';
import { FormStoreContext } from '@esheet/fields';
import {
  createDocumentListRuntimeExtension,
  type DocumentListRepository,
  type DocumentListRuntimeState,
} from './document-list-runtime.js';
import type { DocumentListCapabilities, DocumentListDocument } from './types.js';

type DataVisGridProps = Partial<ComponentProps<typeof DataVisNitroGrid>>;
type DataVisView = ContextType<typeof DataVisNitroContext>;
const OptionalDataVisNitroGrid =
  DataVisNitroGrid as unknown as ComponentType<DataVisGridProps>;

export type DocumentListColumn =
  | (typeof DOCUMENT_LIST_COLUMNS)[number]
  | typeof DOCUMENT_LIST_ACTIONS_COLUMN;

export interface DocumentListRowCapabilities {
  readonly canView: boolean;
  readonly canCompose: boolean;
  readonly canEdit: boolean;
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

export interface DocumentListFieldRuntimeOptions {
  readonly formInstanceId?: string;
  readonly repository?: DocumentListRepository;
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
  readonly onUpload?: DocumentListFieldAction;
  /**
   * Who may do what, resolved by the host — the field never sees roles,
   * levels or a grant table. Rows the object cannot `view` are hidden and
   * compose/upload appear only for types it can `create`. **Absent means
   * read-only** (the migration default: saying nothing must never widen
   * access); a demo with nobody to protect passes
   * `permissiveDocumentListCapabilities` explicitly.
   */
  readonly capabilities?: DocumentListCapabilities;
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
        <ComposerSessionProvider>{children}</ComposerSessionProvider>
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
  onDocumentsChangeRef.current = onDocumentsChange;
  runtime?.registerField(fieldId);
  return useMemo(() => {
    if (!formStore) return null;
    const formInstanceId =
      formStore.getState().instanceId ??
      runtime?.options.formInstanceId ??
      'document-list-provider';
    return (
      createDocumentListRuntimeExtension({
        formStore,
        context: { formInstanceId, fieldId },
        repository: runtime?.options.repository,
        initialDocuments,
        // The extension outlives any one render, so the callback stays behind
        // a ref rather than being captured at creation.
        onDocumentsChange: (documents) =>
          onDocumentsChangeRef.current?.(documents),
      }) ?? null
    );
  }, [fieldId, formStore, initialDocuments, runtime]);
}

const DEFAULT_ROW_CAPABILITIES: DocumentListRowCapabilities = {
  canView: true,
  canCompose: true,
  canEdit: true,
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
  rows: readonly DocumentListDocument[]
): void {
  const windowRecord = window as unknown as Record<string, unknown>;
  windowRecord[sourceKey] = createLocalSourcePayload(rows);
}

function refreshView(view: ComputedView): void {
  const source = view.source as unknown as { cache?: Record<string, unknown> };
  source.cache = {};
  view.clearCache();
  view.getData();
}

function useDocumentListView(rows: readonly DocumentListDocument[]): {
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
    publishRows(key, rows);
    const nextView = new ComputedView(
      new Source({ type: 'local', varName: key })
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
    publishRows(key, rows);
    const refreshTimer = window.setTimeout(() => {
      if (viewRef.current) refreshView(viewRef.current);
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [rows]);

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
  const { view } = useDocumentListView(rows);
  const gridColumns = renderActions
    ? columns.some(
        (column) => column.field === DOCUMENT_LIST_ACTIONS_COLUMN.field
      )
      ? columns
      : [...columns, DOCUMENT_LIST_ACTIONS_COLUMN]
    : columns;
  const gridFormatCell: DataVisGridProps['formatCell'] =
    formatCell || renderActions
      ? (value, row, column) => {
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
          return formatCell?.(value, row, column);
        }
      : undefined;
  const gridOnRowClick: DataVisGridProps['onRowClick'] = onRowClick
    ? (row, event) => {
        const document = documentFromTableRow(row);
        if (document) onRowClick(document, event);
      }
    : undefined;
  const gridOnRowDoubleClick: DataVisGridProps['onRowDoubleClick'] =
    onRowDoubleClick
      ? (row, event) => {
          const document = documentFromTableRow(row);
          if (document) onRowDoubleClick(document, event);
        }
      : undefined;
  const gridRenderDetailRow: DataVisGridProps['renderDetailRow'] =
    renderDetailRow
      ? (row) => {
          const document = documentFromTableRow(row);
          return document ? renderDetailRow(document) : null;
        }
      : undefined;
  const gridTitleActions =
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
    ) : undefined;

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
          title={title}
          titleActions={gridTitleActions}
          columns={gridColumns as DataVisGridProps['columns']}
          formatCell={gridFormatCell}
          onRowClick={gridOnRowClick}
          onRowDoubleClick={gridOnRowDoubleClick}
          renderDetailRow={gridRenderDetailRow}
          detailRowsExpanded={detailRowsExpanded}
          style={{ width: '100%', ...style }}
        />
      </div>
    </DataVisNitroContext.Provider>
  );
}
