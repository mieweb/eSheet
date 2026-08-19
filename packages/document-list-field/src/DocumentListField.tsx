import {
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
} from './DocumentListGrid.js';
import { normalizeDocumentRows, parseDocumentListAnswer } from './data.js';
import {
  getDocumentListRuntimeState,
  type DocumentListRuntimeState,
} from './document-list-runtime.js';
import {
  DocumentListComposeModal,
  DocumentListDetailRow,
  DocumentListUploadModal,
} from './DocumentListWorkflows.js';
import type { DocumentListDefinition, DocumentListDocument } from './types.js';

const subscribeToNothing = (): (() => void) => () => {};
const getEmptyRuntimeState = (): DocumentListRuntimeState | null => null;

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
  useDocumentListFieldRuntime(field.definition.id, initialRows);
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
  const formInstanceId = form?.getState().instanceId ?? 'document-list-form';
  const inputPrefix = `${formInstanceId}-${field.definition.id}`;
  const gridDetailRowsExpanded = host?.detailRowsExpanded ?? detailRowsExpanded;
  const handleToggleDetails =
    host?.onToggleDetails ??
    (runtimeState
      ? () => setDetailRowsExpanded((expanded) => !expanded)
      : undefined);
  const handleCompose = runtimeState
    ? host?.onCompose
      ? () => void host.onCompose?.(runtimeState)
      : () => setComposeOpen(true)
    : undefined;
  const handleUpload = runtimeState
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
    <section className="document-list-field" aria-label={title}>
      <DocumentListGrid
        rows={rows}
        title={title}
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
      {runtimeState && !host?.onCompose && (
        <DocumentListComposeModal
          open={composeOpen}
          onOpenChange={setComposeOpen}
          runtime={runtimeState}
          inputPrefix={inputPrefix}
        />
      )}
      {runtimeState && !host?.onUpload && (
        <DocumentListUploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          runtime={runtimeState}
          inputPrefix={inputPrefix}
        />
      )}
    </section>
  );
}
