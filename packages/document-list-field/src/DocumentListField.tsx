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
import { Button } from '@mieweb/ui';
import type { DraftPresence } from './draftChannel.js';
import { mdyBody, parseMdy } from './mdy.js';
import {
  ComposerSessionOverlay,
  useComposerSession,
  useComposerSessionValue,
  type ComposerSessionConfig,
  type DefinitionPrefill,
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

  // ED.38 — who is drafting each row, said on the row itself. One presence
  // subscription per visible row; the channel keeps them body-free.
  const draftChannel = host?.draftChannel;
  const [presenceByRow, setPresenceByRow] = useState<
    Record<string, readonly DraftPresence[]>
  >({});
  useEffect(() => {
    if (!draftChannel) return;
    const offs = rows.map((row) =>
      draftChannel.presenceOf(row.id, (present) =>
        setPresenceByRow((current) => {
          if (present.length === 0 && !(row.id in current)) return current;
          const next = { ...current };
          if (present.length === 0) delete next[row.id];
          else next[row.id] = present;
          return next;
        })
      )
    );
    return () => {
      for (const off of offs) off();
    };
  }, [draftChannel, rows]);

  const presenceFormatCell = useMemo(() => {
    if (!draftChannel) return undefined;
    const format: NonNullable<
      Parameters<typeof DocumentListGrid>[0]['formatCell']
    > = (value, row, column) => {
      if (column.field !== 'title') return undefined;
      const present = presenceByRow[String(row.id ?? '')];
      if (!present?.length) return undefined;
      const names = present.map((entry) => entry.user.name).join(', ');
      return (
        <span className="document-list-row-presence">
          {String(value ?? '')}
          <span
            className="document-list-row-presence__badges"
            role="img"
            aria-label={`Draft in progress — ${names}`}
            title={`Draft in progress — ${names}`}
          >
            {present.map((entry) => (
              <span
                key={entry.user.id}
                className="document-list-row-presence__dot"
                style={{ backgroundColor: entry.color ?? '#888' }}
              />
            ))}
          </span>
        </span>
      );
    };
    return format;
  }, [draftChannel, presenceByRow]);
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

  // ED.40 — Edit opens *or joins* the row's draft; a new draft is prefilled
  // from the last saved revision (the reverse of the ED.30 save). Which tier
  // decides the shape: a definition parses front matter back into answers, a
  // note loads its body — and a parse failure is the note tier, never an
  // error (ED.34's rule extended).
  const openEdit = async (
    row: DocumentListDocument,
    options?: { append?: boolean }
  ): Promise<void> => {
    const openedBy = host?.author;
    if (!draftChannel || !openedBy || !runtimeState) return;
    const documentDraft = await draftChannel.open(row.id, {
      openedBy,
      baseRev: row.rev ?? 0,
    });
    const display = (value: string): string => (value === '—' ? '' : value);
    const composeDraft = {
      title: display(row.title),
      subject: display(row.subject),
      docType: display(row.docType),
      note: '',
    };
    let definitionPrefill: DefinitionPrefill | undefined;
    if (documentDraft.isNew) {
      let text = row.body ?? '';
      if (row.body == null) {
        try {
          text = (await runtimeState.loadContent(row.id))?.text ?? '';
        } catch {
          text = '';
        }
      }
      const typed = definition.docTypes?.find(
        (docType) => docType.id === row.docType
      );
      const mdy = parseMdy(text);
      if (typed?.definition && mdy.frontMatter) {
        definitionPrefill = {
          responses: mdy.frontMatter.response ?? {},
          body: mdy.body,
        };
      } else {
        composeDraft.note = mdyBody(text);
      }
    }
    session.open({
      kind: 'compose',
      fieldId: field.definition.id,
      runtime: runtimeState,
      config: composerConfig,
      documentDraft,
      documentId: row.id,
      append: options?.append,
      draft: composeDraft,
      definitionPrefill,
    });
  };
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
        <DocumentListDetailRow
          document={row}
          runtime={runtimeState}
          // ED.41 — the original renders its addenda beneath itself.
          related={rows.filter(
            (candidate) => candidate.linkedTo?.id === row.id
          )}
        />
      )
    : undefined;

  // The capability object answers per-row questions unless the host renders
  // its own actions; signature and PDF stay off until something backs them.
  const getRowCapabilities =
    host?.getRowCapabilities ??
    ((row: DocumentListDocument) => ({
      canView: capabilities.view(row),
      canCompose: mayCreate,
      canEdit: capabilities.edit(row),
      canAppend: capabilities.append(row),
      canRequestSignature: false,
      canDelete: capabilities.remove(row),
      canDownloadPdf: false,
    }));
  const renderActions =
    host?.renderActions ??
    (draftChannel && host?.author
      ? (
          row: DocumentListDocument,
          caps: { canEdit: boolean; canAppend: boolean }
        ) => (
          <>
            {caps.canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Edit ${row.title}`}
                onClick={() => void openEdit(row)}
              >
                Edit
              </Button>
            )}
            {caps.canAppend && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Append to ${row.title}`}
                onClick={() => void openEdit(row, { append: true })}
              >
                Append
              </Button>
            )}
          </>
        )
      : undefined);

  return (
    <section className="document-list-field" aria-label={title}>
      <DocumentListGrid
        rows={rows}
        title={title}
        noun={noun}
        columns={columns}
        titleActions={host?.titleActions}
        renderActions={renderActions}
        getRowCapabilities={getRowCapabilities}
        formatCell={presenceFormatCell}
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
