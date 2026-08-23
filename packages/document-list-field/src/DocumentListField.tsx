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
  ComposerSessionOverlay,
  useComposerSession,
  useComposerSessionValue,
  type ComposerSessionConfig,
} from './ComposerSession.js';
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
import { DocumentListDetailRow } from './DocumentListWorkflows.js';
import type {
  DocumentListCapabilities,
  DocumentListDefinition,
  DocumentListDocument,
  DocumentListWorkflow,
} from './types.js';
import {
  permissiveDocumentListCapabilities,
  readOnlyDocumentListCapabilities,
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

/** May this user author any of the types the compose picker would offer? */
function canCreateAny(
  capabilities: DocumentListCapabilities,
  definition: DocumentListDefinition
): boolean {
  if (!definition.docTypes || definition.docTypes.length === 0) {
    // Free-text type: the host answers for the field's default ('').
    return capabilities.create('');
  }
  return definition.docTypes.some((docType) => capabilities.create(docType.id));
}

export function DocumentListField({
  field,
  form,
  response,
  onResponse,
}: FieldComponentProps): React.JSX.Element {
  const definition = field.definition as DocumentListDefinition;
  const host = useDocumentListFieldHost();
  // A bare field with no provider is a local preview with nothing to protect;
  // a host that says nothing gets read-only — absence must never widen access.
  const capabilities = host
    ? host.capabilities ?? readOnlyDocumentListCapabilities
    : permissiveDocumentListCapabilities;
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
  const rows = useMemo(() => {
    const all = runtimeRows(runtimeState) ?? initialRows;
    return all.filter((row) => capabilities.view(row));
  }, [capabilities, initialRows, runtimeState]);
  const [detailRowsExpanded, setDetailRowsExpanded] = useState(false);
  const sharedSession = useComposerSession();
  // Standalone fields (no provider) keep a session of their own, so the panel
  // behaves the same either way — it just cannot outlive this field.
  const ownSession = useComposerSessionValue();
  const session = sharedSession ?? ownSession;

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
  const composerConfig: ComposerSessionConfig = {
    inputPrefix,
    noun,
    fields: columnFields,
    // The picker offers only what this user may author.
    docTypes: definition.docTypes?.filter((docType) =>
      capabilities.create(docType.id)
    ),
    defaultInline: definition.inline,
    accept: definition.accept,
    maxFileSize: definition.maxFileSize,
    author: host?.author,
  };
  const gridDetailRowsExpanded = host?.detailRowsExpanded ?? detailRowsExpanded;
  const handleToggleDetails =
    host?.onToggleDetails ??
    (runtimeState
      ? () => setDetailRowsExpanded((expanded) => !expanded)
      : undefined);
  const openSession =
    (kind: DocumentListWorkflow, runtime: DocumentListRuntimeState) => () =>
      session.open({
        kind,
        fieldId: field.definition.id,
        runtime,
        config: composerConfig,
      });
  const mayCreate = canCreateAny(capabilities, definition);
  const handleCompose =
    runtimeState && offers(definition, 'compose') && mayCreate
      ? host?.onCompose
        ? () => void host.onCompose?.(runtimeState)
        : openSession('compose', runtimeState)
      : undefined;
  const handleUpload =
    runtimeState && offers(definition, 'upload') && mayCreate
      ? host?.onUpload
        ? () => void host.onUpload?.(runtimeState)
        : openSession('upload', runtimeState)
      : undefined;
  const detailRenderer = host?.renderDetailRow
    ? host.renderDetailRow
    : runtimeState
    ? (row: DocumentListDocument) => (
        <DocumentListDetailRow document={row} runtime={runtimeState} />
      )
    : undefined;

  return (
    <section className="document-list-field" aria-label={title}>
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
      {!sharedSession && <ComposerSessionOverlay value={ownSession} />}
    </section>
  );
}
