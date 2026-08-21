import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import {
  DocumentListGrid,
  useDocumentListFieldHost,
  useDocumentListFieldRuntime,
  type DocumentListColumn,
} from './DocumentListGrid.js';
import {
  DOCUMENT_LIST_COLUMNS,
  documentListValueFromRows,
  normalizeDocumentRows,
  parseDocumentListAnswer,
} from './data.js';
import {
  getDocumentListRuntimeState,
  type DocumentListRuntimeState,
} from './document-list-runtime.js';
import {
  DocumentListComposePanel,
  DocumentListDetailRow,
  DocumentListUploadPanel,
} from './DocumentListWorkflows.js';
import type {
  DocumentListDefinition,
  DocumentListDocument,
  DocumentListWorkflow,
} from './types.js';

const subscribeToNothing = (): (() => void) => () => {};
const getEmptyRuntimeState = (): DocumentListRuntimeState | null => null;

/** A field offers every workflow unless its definition names a subset. */
function offers(
  definition: DocumentListDefinition,
  workflow: DocumentListWorkflow
): boolean {
  return !definition.workflows || definition.workflows.includes(workflow);
}

/** The named columns in the order the definition gives them, or all of them. */
function columnsOf(
  definition: DocumentListDefinition
): readonly DocumentListColumn[] | undefined {
  if (!definition.columns) return undefined;
  return definition.columns.flatMap((name) => {
    const column = DOCUMENT_LIST_COLUMNS.find(
      (candidate) => candidate.field === name
    );
    return column ? [column] : [];
  });
}

function runtimeRows(
  state: {
    readonly documentIds: readonly string[];
    readonly documents: Readonly<Record<string, DocumentListDocument>>;
  } | null
): DocumentListDocument[] | null {
  if (!state) return null;
  return state.documentIds.flatMap((documentId) => {
    const document = state.documents[documentId];
    return document ? [document] : [];
  });
}

export function DocumentListField({
  field,
  form,
  response,
  onResponse,
}: FieldComponentProps): React.JSX.Element {
  const definition = field.definition as DocumentListDefinition;
  const host = useDocumentListFieldHost();
  const formStore = useContext(FormStoreContext);
  const initialRows = useMemo(
    () =>
      response?.answer
        ? parseDocumentListAnswer(response.answer)
        : normalizeDocumentRows(definition.documents),
    [definition.documents, response?.answer]
  );
  const publishRows = useCallback(
    (rows: readonly DocumentListDocument[]) => {
      onResponse?.({
        ...response,
        answer: JSON.stringify(documentListValueFromRows(rows)),
      });
    },
    [onResponse, response]
  );
  useDocumentListFieldRuntime(field.definition.id, initialRows, publishRows);
  const runtimeState = useSyncExternalStore(
    formStore?.subscribe ?? subscribeToNothing,
    () =>
      formStore
        ? getDocumentListRuntimeState(formStore, field.definition.id) ?? null
        : null,
    getEmptyRuntimeState
  );
  const rows = useMemo(
    () => runtimeRows(runtimeState) ?? initialRows,
    [initialRows, runtimeState]
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailRowsExpanded, setDetailRowsExpanded] = useState(false);

  useEffect(() => {
    if (!formStore) return;
    const runtimeState = getDocumentListRuntimeState(
      formStore,
      field.definition.id
    );
    if (!runtimeState) return;
    runtimeState.hydrateSnapshot({ documents: initialRows });
    runtimeState.start();
    void runtimeState.refresh().catch(() => undefined);
  }, [field.definition.id, formStore, initialRows]);

  const title =
    typeof definition.question === 'string' && definition.question.trim()
      ? definition.question
      : 'Documents';
  const noun = definition.noun?.trim() || undefined;
  const columns = columnsOf(definition);
  const columnFields = columns?.map((column) => column.field);
  const formInstanceId = form?.getState().instanceId ?? 'document-list-form';
  const inputPrefix = `${formInstanceId}-${field.definition.id}`;
  const gridDetailRowsExpanded = host?.detailRowsExpanded ?? detailRowsExpanded;
  const handleToggleDetails =
    host?.onToggleDetails ??
    (runtimeState
      ? () => setDetailRowsExpanded((expanded) => !expanded)
      : undefined);
  const handleCompose =
    runtimeState && offers(definition, 'compose')
      ? host?.onCompose
        ? () => void host.onCompose?.(runtimeState)
        : () => setComposeOpen(true)
      : undefined;
  const handleUpload =
    runtimeState && offers(definition, 'upload')
      ? host?.onUpload
        ? () => void host.onUpload?.(runtimeState)
        : () => setUploadOpen(true)
      : undefined;
  const detailRenderer = host?.renderDetailRow
    ? host.renderDetailRow
    : runtimeState
    ? (row: DocumentListDocument) => (
        <DocumentListDetailRow document={row} runtime={runtimeState} />
      )
    : undefined;

  return (
    <section
      className={`document-list-field${
        composeOpen || uploadOpen ? ' document-list-field--workflow-open' : ''
      }`}
      aria-label={title}
    >
      <DocumentListGrid
        rows={rows}
        title={title}
        noun={noun}
        columns={columns}
        titleActions={host?.titleActions}
        renderActions={host?.renderActions}
        getRowCapabilities={host?.getRowCapabilities}
        onRowClick={host?.onRowClick}
        onRowDoubleClick={host?.onRowDoubleClick}
        renderDetailRow={detailRenderer}
        detailRowsExpanded={gridDetailRowsExpanded}
        onToggleDetails={handleToggleDetails}
        onCompose={handleCompose}
        onUpload={handleUpload}
        loading={
          host?.loading === true || runtimeState?.syncStatus === 'loading'
        }
        error={runtimeState?.error ?? host?.error}
      />
      {runtimeState && !host?.onCompose && composeOpen && (
        <DocumentListComposePanel
          open
          onOpenChange={setComposeOpen}
          runtime={runtimeState}
          inputPrefix={inputPrefix}
          noun={noun}
          fields={columnFields}
          docTypes={definition.docTypes}
          defaultInline={definition.inline}
        />
      )}
      {runtimeState && !host?.onUpload && uploadOpen && (
        <DocumentListUploadPanel
          open
          onOpenChange={setUploadOpen}
          runtime={runtimeState}
          inputPrefix={inputPrefix}
          noun={noun}
          accept={definition.accept}
          maxFileSize={definition.maxFileSize}
        />
      )}
    </section>
  );
}
