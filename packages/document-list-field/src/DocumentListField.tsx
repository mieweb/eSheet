import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
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

  return (
    <section className="document-list-field" aria-label={title}>
      <DocumentListGrid
        rows={rows}
        title={title}
        {...(host ?? {})}
        onCompose={
          host?.onCompose && runtimeState
            ? () => void host.onCompose?.(runtimeState)
            : undefined
        }
        onUpload={
          host?.onUpload && runtimeState
            ? () => void host.onUpload?.(runtimeState)
            : undefined
        }
        loading={
          host?.loading === true || runtimeState?.syncStatus === 'loading'
        }
        error={runtimeState?.error ?? host?.error}
      />
    </section>
  );
}
