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
import { Button, Input } from '@mieweb/ui';
import { ArchiveRestore, ListPlus, SquarePen, Trash2 } from 'lucide-react';
import type { DraftPresence } from './draftChannel.js';
import { mdyBody, parseMdy } from './mdy.js';
import { priorRevisionOf } from './data.js';
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

/** Uploads carry their MIME type as `docType`; composed types never do.
 * A file's bytes aren't editable prose — only its title is. */
function isFileRow(row: DocumentListDocument): boolean {
  return row.docType.includes('/');
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
  const [detailRowsExpanded, setDetailRowsExpanded] = useState(
    definition.expandDetails ?? false
  );
  // ED.42 — tombstoned rows leave the grid but never the answer.
  const [showRemoved, setShowRemoved] = useState(false);
  const [removing, setRemoving] = useState<DocumentListDocument | null>(null);
  const [renaming, setRenaming] = useState<DocumentListDocument | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const removedCount = useMemo(
    () => rows.filter((row) => row.removed).length,
    [rows]
  );
  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => showRemoved || !row.removed)
        // Newest on top: date is the shared display column; undated rows
        // sink, ties keep answer order (stable sort).
        .sort((a, b) => {
          const aDate = a.date === '—' ? '' : a.date;
          const bDate = b.date === '—' ? '' : b.date;
          return bDate.localeCompare(aDate);
        }),
    [rows, showRemoved]
  );

  // ED.38 — who is drafting each row, said on the row itself. One presence
  // subscription per visible row; the channel keeps them body-free. Keyed by
  // the id list, not the array identity — every store update makes a fresh
  // array and resubscribing per keystroke would churn sockets.
  const draftChannel = host?.draftChannel;
  const [presenceByRow, setPresenceByRow] = useState<
    Record<string, readonly DraftPresence[]>
  >({});
  const rowIdKey = useMemo(() => rows.map((row) => row.id).join('\n'), [rows]);
  useEffect(() => {
    if (!draftChannel) return;
    const ids = rowIdKey ? rowIdKey.split('\n') : [];
    const offs = ids.map((id) =>
      draftChannel.presenceOf(id, (present) =>
        setPresenceByRow((current) => {
          if (present.length === 0 && !(id in current)) return current;
          const next = { ...current };
          if (present.length === 0) delete next[id];
          else next[id] = present;
          return next;
        })
      )
    );
    return () => {
      for (const off of offs) off();
    };
  }, [draftChannel, rowIdKey]);

  const presenceFormatCell = useMemo(() => {
    if (!draftChannel) return undefined;
    // Badges ride the title cell; a field whose columns drop `title`
    // (title-less notes) badges its first column instead.
    const configured = definition.columns;
    const presenceField =
      !configured || configured.includes('title')
        ? 'title'
        : configured[0] ?? 'title';
    const format: NonNullable<
      Parameters<typeof DocumentListGrid>[0]['formatCell']
    > = (value, row, column) => {
      if (column.field !== presenceField) return undefined;
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
  }, [draftChannel, definition.columns, presenceByRow]);
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
    renderTemplate: host?.renderTemplate,
  };
  const gridDetailRowsExpanded = host?.detailRowsExpanded ?? detailRowsExpanded;

  // ED.40 — Edit opens *or joins* the row's draft; a new draft is prefilled
  // from the last saved revision (the reverse of the ED.30 save). Which tier
  // decides the shape: a definition parses front matter back into answers, a
  // note loads its body — and a parse failure is the note tier, never an
  // error (ED.34's rule extended).
  // ED.42 — remove tombstones with a reason; restore is the same grant.
  // Both are saves of their own kind: rev + 1, prior head kept in history.
  const tombstone = async (
    row: DocumentListDocument,
    reason: string
  ): Promise<void> => {
    if (!runtimeState) return;
    await runtimeState.saveDocument({
      ...row,
      rev: (row.rev ?? 0) + 1,
      action: 'remove',
      removed: {
        ...(host?.author ? { author: host.author } : {}),
        at: new Date().toISOString(),
        reason,
      },
      ...(row.body != null
        ? { history: [...(row.history ?? []), priorRevisionOf(row)] }
        : {}),
    });
    // Removal is the stronger statement: any open draft is discarded, and
    // the channel tells whoever is in it (onDiscarded).
    if (draftChannel && host?.author) {
      const draft = await draftChannel.open(row.id, {
        openedBy: host.author,
        baseRev: row.rev ?? 0,
      });
      await draft.discard();
    }
  };

  const restore = async (row: DocumentListDocument): Promise<void> => {
    if (!runtimeState) return;
    const { removed: _removed, ...rest } = row;
    void _removed;
    await runtimeState.saveDocument({
      ...rest,
      rev: (row.rev ?? 0) + 1,
      action: 'restore',
      ...(row.body != null
        ? { history: [...(row.history ?? []), priorRevisionOf(row)] }
        : {}),
    });
  };

  // A file row's only editable prose is its title — a metadata-only save.
  const rename = async (
    row: DocumentListDocument,
    title: string
  ): Promise<void> => {
    if (!runtimeState) return;
    await runtimeState.saveDocument({
      ...row,
      title,
      rev: (row.rev ?? 0) + 1,
      action: 'edit',
      ...(row.body != null
        ? { history: [...(row.history ?? []), priorRevisionOf(row)] }
        : {}),
    });
  };

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
        // A head with no front matter revises as a note even when its type
        // has a definition since (ED.40's parse-failure rule) — recorded on
        // the draft so joiners land in the same tier as the opener.
        if (typed?.definition) documentDraft.setAnswer('meta:tier', 'note');
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
  // The whole field is a drop target when the session-based uploader is on:
  // a dropped file opens the upload panel with the file already selected.
  const acceptsDrop =
    runtimeState && offers(definition, 'upload') && mayCreate && !host?.onUpload
      ? runtimeState
      : undefined;
  const dropHandlers = acceptsDrop
    ? {
        onDragOver: (event: React.DragEvent) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDropActive(true);
        },
        onDragLeave: (event: React.DragEvent) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDropActive(false);
        },
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          setDropActive(false);
          const dropped = event.dataTransfer.files?.[0];
          if (!dropped) return;
          session.open({
            kind: 'upload',
            fieldId: field.definition.id,
            runtime: acceptsDrop,
            config: composerConfig,
            initialFile: dropped,
          });
        },
      }
    : undefined;
  const detailRenderer = host?.renderDetailRow
    ? host.renderDetailRow
    : runtimeState
    ? (row: DocumentListDocument) => (
        <DocumentListDetailRow
          document={row}
          runtime={runtimeState}
          historyHref={host?.documentHref?.(row) ?? undefined}
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
          caps: { canEdit: boolean; canAppend: boolean; canDelete: boolean }
        ) =>
          row.removed ? (
            caps.canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Restore ${row.title}`}
                title="Restore"
                onClick={() => void restore(row)}
              >
                <ArchiveRestore size={16} aria-hidden="true" />
              </Button>
            ) : null
          ) : (
            <span className="document-list-field__row-actions">
              {caps.canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    isFileRow(row) ? `Rename ${row.title}` : `Edit ${row.title}`
                  }
                  title={isFileRow(row) ? 'Rename' : 'Edit'}
                  onClick={() =>
                    isFileRow(row) ? setRenaming(row) : void openEdit(row)
                  }
                >
                  <SquarePen size={16} aria-hidden="true" />
                </Button>
              )}
              {caps.canAppend && !isFileRow(row) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Append to ${row.title}`}
                  title="Append"
                  onClick={() => void openEdit(row, { append: true })}
                >
                  <ListPlus size={16} aria-hidden="true" />
                </Button>
              )}
              {caps.canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.title}`}
                  title="Remove"
                  onClick={() => setRemoving(row)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              )}
            </span>
          )
      : undefined);

  const titleActions = (
    <>
      {host?.titleActions}
      {removedCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showRemoved}
          onClick={() => setShowRemoved((current) => !current)}
        >
          {showRemoved ? 'Hide removed' : `Show removed (${removedCount})`}
        </Button>
      )}
    </>
  );

  return (
    <section
      className={`document-list-field${
        dropActive ? ' document-list-field--drop-active' : ''
      }`}
      aria-label={title}
      {...dropHandlers}
    >
      <DocumentListGrid
        rows={visibleRows}
        title={title}
        noun={noun}
        columns={columns}
        titleActions={titleActions}
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
      {removing && (
        <RemoveDocumentDialog
          document={removing}
          noun={noun ?? 'document'}
          onCancel={() => setRemoving(null)}
          onRemove={async (reason) => {
            setRemoving(null);
            await tombstone(removing, reason);
          }}
        />
      )}
      {renaming && (
        <RenameDocumentDialog
          document={renaming}
          onCancel={() => setRenaming(null)}
          onRename={async (title) => {
            setRenaming(null);
            await rename(renaming, title);
          }}
        />
      )}
      {!sharedSession && <ComposerSessionOverlay value={ownSession} />}
    </section>
  );
}

/** ED.42 — removal always carries a reason; free text, required. */
function RemoveDocumentDialog({
  document,
  noun,
  onCancel,
  onRemove,
}: {
  readonly document: DocumentListDocument;
  readonly noun: string;
  readonly onCancel: () => void;
  readonly onRemove: (reason: string) => void | Promise<void>;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  return (
    <div
      className="document-list-remove-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={`Remove ${noun}`}
    >
      <form
        className="document-list-remove-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim()) void onRemove(reason.trim());
        }}
      >
        <p>
          Remove “{document.title}”? It leaves the list but stays in the record,
          with your reason on the tombstone.
        </p>
        <Input
          id={`remove-reason-${document.id}`}
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          autoFocus
        />
        <div className="document-list-remove-dialog__actions">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!reason.trim()}
          >
            Remove
          </Button>
        </div>
      </form>
    </div>
  );
}

/** A file's bytes are immutable; renaming its title is the only edit. */
function RenameDocumentDialog({
  document,
  onCancel,
  onRename,
}: {
  readonly document: DocumentListDocument;
  readonly onCancel: () => void;
  readonly onRename: (title: string) => void | Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState(document.title);
  const unchanged = title.trim() === document.title || !title.trim();
  return (
    <div
      className="document-list-remove-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={`Rename ${document.title}`}
    >
      <form
        className="document-list-remove-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!unchanged) void onRename(title.trim());
        }}
      >
        <p>Rename “{document.title}”? The file itself is unchanged.</p>
        <Input
          id={`rename-title-${document.id}`}
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          autoFocus
        />
        <div className="document-list-remove-dialog__actions">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={unchanged}
          >
            Rename
          </Button>
        </div>
      </form>
    </div>
  );
}
