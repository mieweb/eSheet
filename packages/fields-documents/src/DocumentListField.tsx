import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import { TableRenderer, type TableRendererProps } from '@mieweb/datavis';
import {
  Button,
  Input,
  formatRegionalDate,
  regionalDateLocale,
} from '@mieweb/ui';
import {
  ArchiveRestore,
  FileDown,
  ListPlus,
  SquarePen,
  Trash2,
} from 'lucide-react';
import type { DocumentDraft, DraftPresence } from './draftChannel.js';
import { mdyBody, parseMdy } from './mdy.js';
import { docTypeSerialization, priorRevisionOf } from './data.js';
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
  type DocumentListFieldHost,
} from './DocumentListGrid.js';
import {
  DOCUMENT_LIST_ACTIONS_COLUMN,
  DOCUMENT_LIST_COLUMNS,
  SUBMISSION_COLUMNS,
  documentListValueFromRows,
  formatSubmissionTimestamp,
  normalizeDocumentRows,
  normalizeDocumentRow,
  parseDocumentListAnswer,
} from './data.js';
import {
  getDocumentListRuntimeState,
  NOTE_REVISION_LOCKED,
  type DocumentListRuntimeState,
} from './document-list-runtime.js';
import { DocumentListDetailRow } from './DocumentListWorkflows.js';
import { DocumentListPdfPreview } from './DocumentListPdfPreview.js';
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
const submissionColumns = [
  ...SUBMISSION_COLUMNS,
  ...DOCUMENT_LIST_COLUMNS.filter(({ field }) => field === 'rev'),
];

/** A field offers every workflow unless its definition names a subset. */
function offers(
  definition: DocumentListDefinition,
  workflow: DocumentListWorkflow
): boolean {
  return !definition.workflows || definition.workflows.includes(workflow);
}

function offersAction(
  definition: DocumentListDefinition,
  action: 'downloadPdf'
): boolean {
  return definition.actions?.includes(action) ?? false;
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

function DocumentListBranchBody({
  className,
  children,
}: {
  readonly className: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const body = ref.current;
    const row = body?.closest('.wcdv-detail-tr')?.previousElementSibling;
    const toggle = row?.querySelector('.wcdv-td-detail-toggle');
    const chevron = toggle?.querySelector('button svg');
    if (!body || !toggle || !chevron) return;

    const align = () => {
      const bounds = body.getBoundingClientRect();
      const icon = chevron.getBoundingClientRect();
      if (!icon.width) return;
      const center = icon.left + icon.width / 2;
      const offset =
        getComputedStyle(body).direction === 'rtl'
          ? bounds.right - center
          : center - bounds.left;
      body.style.setProperty(
        '--document-list-elbow-start',
        `${offset - 0.5}px`
      );
    };

    align();
    window.addEventListener('resize', align);
    const resize =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(align);
    resize?.observe(body);
    resize?.observe(toggle);
    resize?.observe(chevron);
    return () => {
      window.removeEventListener('resize', align);
      resize?.disconnect();
    };
  }, []);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

function DocumentListNotePreview({
  children,
  addenda,
}: {
  readonly children: ReactNode;
  readonly addenda?: ReactNode;
}): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const detail = panelRef.current?.parentElement;
    const cell = detail?.closest('.wcdv-detail-td');
    const row = cell?.parentElement?.previousElementSibling;
    if (!detail || !cell || !row) return;

    const align = () => {
      const toggle = row.querySelector('.wcdv-td-detail-toggle');
      const firstColumn = toggle?.nextElementSibling;
      if (!firstColumn) return;

      const style = getComputedStyle(detail);
      const rtl = style.direction === 'rtl';
      const detailBounds = detail.getBoundingClientRect();
      const columnBounds = firstColumn.getBoundingClientRect();
      const offset = rtl
        ? detailBounds.right - columnBounds.right
        : columnBounds.left - detailBounds.left;
      detail.style.setProperty(
        '--document-list-preview-inset',
        `${Math.max(0, offset)}px`
      );

      const time = firstColumn.nextElementSibling;
      const author = time?.nextElementSibling;
      const widths =
        firstColumn.classList.contains('document-list-grid__submission-date') &&
        time?.classList.contains('document-list-grid__submission-time') &&
        author?.classList.contains('document-list-grid__submission-author')
          ? [
              columnBounds.width,
              time.getBoundingClientRect().width,
              author.getBoundingClientRect().width,
            ]
          : undefined;
      const canAlign = widths?.every((width) => width > 0);
      ['date', 'time', 'author'].forEach((column, index) => {
        const property = `--document-list-outer-${column}-width`;
        if (canAlign && widths) {
          detail.style.setProperty(property, `${widths[index]}px`);
        } else {
          detail.style.removeProperty(property);
        }
      });
      if (canAlign && author?.nextElementSibling) {
        detail.style.setProperty(
          '--document-list-addenda-trailing-display',
          'table-cell'
        );
      } else {
        detail.style.removeProperty('--document-list-addenda-trailing-display');
      }
    };

    const resize =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(align);
    const observeColumns = () => {
      resize?.disconnect();
      resize?.observe(cell);
      for (const column of Array.from(row.children)) resize?.observe(column);
      align();
    };
    observeColumns();
    const mutations = new MutationObserver(observeColumns);
    mutations.observe(row, { childList: true });
    return () => {
      mutations.disconnect();
      resize?.disconnect();
    };
  }, []);

  return (
    <div className="document-list-note-preview" ref={panelRef}>
      <DocumentListBranchBody className="document-list-note-preview__body">
        {children}
      </DocumentListBranchBody>
      {addenda}
    </div>
  );
}

const ADDENDA_COLUMNS = SUBMISSION_COLUMNS.map((column) => ({
  ...column,
  sortable: false,
  filterable: false,
  resizable: false,
}));
const ADDENDA_COLUMNS_WITH_SPACER: TableRendererProps['columns'] = [
  ...ADDENDA_COLUMNS,
  {
    field: '_spacer',
    header: '',
    sortable: false,
    className: 'document-list-addenda-preview__spacer',
  },
];
const ADDENDA_COLUMNS_WITH_ACTIONS = [
  ...ADDENDA_COLUMNS,
  DOCUMENT_LIST_ACTIONS_COLUMN,
];

function DocumentListAddendaPreview({
  addenda,
  runtime,
  onViewed,
  documentHref,
  renderDocumentActions,
}: {
  readonly addenda: readonly DocumentListDocument[];
  readonly runtime: DocumentListRuntimeState;
  readonly onViewed: (row: DocumentListDocument) => void;
  readonly documentHref?: DocumentListFieldHost['documentHref'];
  readonly renderDocumentActions?: (row: DocumentListDocument) => ReactNode;
}): React.JSX.Element {
  const documentsById = useMemo(
    () => new Map(addenda.map((document) => [document.id, document])),
    [addenda]
  );
  const viewData = useMemo(
    () => ({
      isPlain: true,
      isGroup: false,
      isPivot: false,
      data: addenda.map((document) => ({
        _rowId: document.id,
        submissionDate: document.submittedAt,
        submissionTime: document.submittedAt,
        submissionAuthor: `${document.recordedAuthor?.name || '—'}${
          document.removed ? ' · Removed' : ''
        }`,
      })),
    }),
    [addenda]
  );
  const locale = regionalDateLocale();
  const headingId = useId();
  return (
    <section
      className="document-list-addenda-preview"
      aria-labelledby={headingId}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <h3 id={headingId} className="document-list-addenda-preview__heading">
        Addenda
      </h3>
      <TableRenderer
        key={renderDocumentActions ? 'with-actions' : 'without-actions'}
        viewData={viewData}
        columns={
          renderDocumentActions
            ? ADDENDA_COLUMNS_WITH_ACTIONS
            : ADDENDA_COLUMNS_WITH_SPACER
        }
        features={{
          columnResize: false,
          columnReorder: false,
          headerContextMenu: false,
          keyboardNav: false,
          rowSelection: false,
          stickyHeaders: false,
        }}
        sorts={null}
        showRowCount={false}
        detailRowsExpanded
        onRowClick={(_, event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('.document-list-addenda-preview__actions')
          ) {
            return;
          }
          event.currentTarget
            .querySelector<HTMLButtonElement>('.wcdv-td-detail-toggle button')
            ?.click();
        }}
        formatCell={(value, { _rowId }, column) => {
          if (column.field === '_spacer') return null;
          if (column.field === DOCUMENT_LIST_ACTIONS_COLUMN.field) {
            const addendum =
              typeof _rowId === 'string'
                ? documentsById.get(_rowId)
                : undefined;
            return addendum ? (
              <span className="document-list-addenda-preview__actions">
                {renderDocumentActions?.(addendum)}
              </span>
            ) : null;
          }
          if (column.field === 'submissionAuthor') return String(value);
          const timestamp = typeof value === 'string' ? value : '';
          const label = formatSubmissionTimestamp(
            timestamp,
            locale,
            column.field === 'submissionDate' ? 'date' : 'time'
          );
          return label ? <time dateTime={timestamp}>{label}</time> : '—';
        }}
        renderDetailRow={({ rowId }) => {
          const addendum = rowId ? documentsById.get(rowId) : undefined;
          return addendum ? (
            <DocumentListBranchBody className="document-list-addenda-preview__content">
              <DocumentListDetailRow
                document={addendum}
                runtime={runtime}
                historyHref={documentHref?.(addendum) ?? undefined}
                onViewed={() => onViewed(addendum)}
              />
            </DocumentListBranchBody>
          ) : null;
        }}
      />
    </section>
  );
}

export function DocumentListField({
  field,
  form,
  response,
  onResponse,
  isReadOnly,
}: FieldComponentProps): React.JSX.Element {
  const definition = field.definition as DocumentListDefinition;
  const host = useDocumentListFieldHost();
  // A bare field with no provider is a local preview with nothing to protect;
  // a host that says nothing gets read-only — absence must never widen access.
  // A read-only form trumps everything: browsing stays, writes go.
  const capabilities = useMemo(
    () =>
      isReadOnly
        ? {
            ...readOnlyDocumentListCapabilities,
            view:
              host?.capabilities?.view ?? readOnlyDocumentListCapabilities.view,
          }
        : host
        ? host.capabilities ?? readOnlyDocumentListCapabilities
        : permissiveDocumentListCapabilities,
    [host, isReadOnly]
  );
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
  const submissionMetadata =
    host?.showSubmissionMetadata?.(field.definition.id) === true;
  const alignDetailPreview =
    submissionMetadata || host?.alignDetailPreview?.(field.definition.id);
  const [removing, setRemoving] = useState<DocumentListDocument | null>(null);
  const [renaming, setRenaming] = useState<DocumentListDocument | null>(null);
  const [exporting, setExporting] = useState<DocumentListDocument | null>(null);
  const [editError, setEditError] = useState<string>();
  const [dropActive, setDropActive] = useState(false);
  const removedCount = useMemo(
    () => rows.filter((row) => row.removed).length,
    [rows]
  );
  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => showRemoved || !row.removed)
        // Newest on top; missing dates sink and ties keep answer order.
        .sort((a, b) => {
          if (submissionMetadata) {
            const aTime = Date.parse(a.submittedAt ?? '');
            const bTime = Date.parse(b.submittedAt ?? '');
            if (Number.isNaN(aTime)) return Number.isNaN(bTime) ? 0 : 1;
            return Number.isNaN(bTime) ? -1 : bTime - aTime;
          }
          const aDate = a.date === '—' ? '' : a.date;
          const bDate = b.date === '—' ? '' : b.date;
          return bDate.localeCompare(aDate);
        }),
    [rows, showRemoved, submissionMetadata]
  );
  const groupAddenda =
    submissionMetadata && runtimeState !== null && !host?.renderDetailRow;
  const { gridRows, addendaByOriginal } = useMemo(() => {
    const addendaByOriginal = new Map<string, DocumentListDocument[]>();
    if (!groupAddenda) {
      return { gridRows: visibleRows, addendaByOriginal };
    }
    const originalIds = new Set(
      visibleRows
        .filter((row) => row.linkedTo?.linkType !== 'addendum')
        .map((row) => row.id)
    );
    const gridRows = visibleRows.filter((row) => {
      const link = row.linkedTo;
      // An addendum with no visible original must still be readable.
      if (link?.linkType !== 'addendum' || !originalIds.has(link.id))
        return true;
      const addenda = addendaByOriginal.get(link.id);
      if (addenda) addenda.push(row);
      else addendaByOriginal.set(link.id, [row]);
      return false;
    });
    return { gridRows, addendaByOriginal };
  }, [visibleRows, groupAddenda]);

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
          const seenAuthorIds = new Set<string>();
          const otherAuthors = present.filter(({ user }) => {
            if (user.id === host?.author?.id || seenAuthorIds.has(user.id)) {
              return false;
            }
            seenAuthorIds.add(user.id);
            return true;
          });
          if (otherAuthors.length === 0 && !(id in current)) return current;
          const next = { ...current };
          if (otherAuthors.length === 0) delete next[id];
          else next[id] = otherAuthors;
          return next;
        })
      )
    );
    return () => {
      for (const off of offs) off();
    };
  }, [draftChannel, host?.author?.id, rowIdKey]);

  const presenceFormatCell = useMemo(() => {
    if (!draftChannel) return undefined;
    // Badges ride the title cell; a field whose columns drop `title`
    // (title-less notes) badges its first column instead.
    const configured = definition.columns;
    const presenceField = submissionMetadata
      ? 'submissionAuthor'
      : !configured || configured.includes('title')
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
          {column.field === 'date'
            ? formatRegionalDate(String(value ?? ''))
            : String(value ?? '')}
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
  }, [draftChannel, definition.columns, presenceByRow, submissionMetadata]);
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
    if (!openedBy || !runtimeState || !formStore) return;
    setEditError(undefined);
    let documentDraft: DocumentDraft | undefined;
    let displayed = false;
    try {
      // Append can save a different document, so it must not join an
      // existing revision proposal for the parent.
      documentDraft =
        !options?.append && draftChannel
          ? await draftChannel.open(row.id, {
              openedBy,
              baseRev: row.rev ?? 0,
            })
          : undefined;
      const content = await runtimeState.loadContent(row.id, undefined, {
        refresh: true,
      });
      const currentRow = getDocumentListRuntimeState(
        formStore,
        field.definition.id
      )?.documents[row.id];
      if (
        !options?.append &&
        (content?.document?.noteEditable === false ||
          currentRow?.noteEditable === false)
      ) {
        setEditError(NOTE_REVISION_LOCKED);
        return;
      }
      const noteEditable =
        content?.document?.noteEditable ??
        currentRow?.noteEditable ??
        row.noteEditable;
      const display = (value: string): string => (value === '—' ? '' : value);
      const composeDraft = {
        title: display(row.title),
        subject: display(row.subject),
        docType: display(row.docType),
        note: '',
        nativeVersion: row.nativeVersion,
        frontMatterSource: '',
      };
      let definitionPrefill: DefinitionPrefill | undefined;
      if (!documentDraft || documentDraft.isNew) {
        if (content?.text === undefined) {
          setEditError(
            'Document content is unavailable. Reload before editing.'
          );
          return;
        }
        const text = content.text;
        if (content.document) {
          row = {
            ...content.document,
            inline:
              content.document.inline ??
              row.inline ??
              (row.body != null ? true : undefined),
          };
          composeDraft.title = display(row.title);
          composeDraft.subject = display(row.subject);
          composeDraft.docType = display(row.docType);
          composeDraft.nativeVersion = row.nativeVersion;
        }
        const typed = definition.docTypes?.find(
          (docType) => docType.id === row.docType
        );
        const mdy = parseMdy(text);
        const textOnly = docTypeSerialization(typed) === 'text';
        if (typed?.definition && !textOnly && !mdy.frontMatter) {
          setEditError(
            'Form metadata is missing or invalid. Reconcile this document before editing.'
          );
          return;
        }
        if (typed?.definition) {
          definitionPrefill = {
            frontMatterSource: textOnly ? '' : mdy.frontMatterSource,
            responses: textOnly
              ? {
                  title: { answer: row.title },
                  subject: { answer: row.subject },
                  date: { answer: row.date },
                }
              : mdy.frontMatter?.response ?? {},
            body: textOnly ? text : mdy.body,
          };
        } else {
          composeDraft.frontMatterSource = mdy.frontMatterSource;
          composeDraft.note = mdyBody(text);
        }
        documentDraft?.setAnswer(
          'meta:frontMatterSource',
          definitionPrefill?.frontMatterSource ?? composeDraft.frontMatterSource
        );
        documentDraft?.setAnswer('meta:nativeVersion', row.nativeVersion);
        documentDraft?.setAnswer('meta:revisionBase', row);
      }
      const revisionBase =
        documentDraft && !documentDraft.isNew
          ? normalizeDocumentRow(
              documentDraft.getAnswers()['meta:revisionBase']
            ) ?? row
          : row;
      session.open({
        kind: 'compose',
        fieldId: field.definition.id,
        runtime: runtimeState,
        config: composerConfig,
        documentDraft,
        documentId: row.id,
        revisionBase: { ...revisionBase, noteEditable },
        append: options?.append,
        draft: composeDraft,
        definitionPrefill,
      });
      displayed = true;
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error));
    } finally {
      if (documentDraft && !displayed) {
        try {
          if (documentDraft.isNew) await documentDraft.discard();
        } catch (error) {
          setEditError(error instanceof Error ? error.message : String(error));
        } finally {
          documentDraft.close();
        }
      }
    }
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
  const composeActionRef = useRef(handleCompose);
  composeActionRef.current = handleCompose;
  const canCompose = Boolean(handleCompose);
  useEffect(
    () =>
      host?.registerComposeAction?.(
        field.definition.id,
        canCompose ? () => composeActionRef.current?.() : undefined
      ),
    [host, field.definition.id, canCompose]
  );
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
  const canPrint =
    offersAction(definition, 'downloadPdf') && runtimeState !== null;

  // The capability object answers per-row questions unless the host renders
  // its own actions. Printing requires both definition and host opt-in.
  // While the form is read-only the host's wider grants don't apply.
  // Note restrictions narrow both host and default grants.
  const getRowCapabilities = (row: DocumentListDocument) => {
    const grants = (!isReadOnly && host?.getRowCapabilities?.(row)) || {
      canView: capabilities.view(row),
      canCompose: mayCreate,
      canEdit: capabilities.edit(row),
      canAppend: capabilities.append(row),
      canRequestSignature: false,
      canDelete: capabilities.remove(row),
      canDownloadPdf: canPrint && capabilities.view(row),
    };
    return {
      ...grants,
      canEdit: grants.canEdit && row.noteEditable !== false,
      canAppend:
        grants.canAppend && !(row.noteEditable !== undefined && row.linkedTo),
      canDelete: grants.canDelete && row.noteEditable !== false,
    };
  };
  const canManageRows = Boolean(!isReadOnly && runtimeState && host?.author);
  const defaultRenderActions =
    canManageRows || canPrint
      ? (
          row: DocumentListDocument,
          caps: {
            canEdit: boolean;
            canAppend: boolean;
            canDelete: boolean;
            canDownloadPdf: boolean;
          }
        ) => (
          <span className="document-list-field__row-actions">
            {row.removed ? (
              canManageRows && caps.canDelete ? (
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
              <>
                {canManageRows && caps.canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      isFileRow(row)
                        ? `Rename ${row.title}`
                        : `Edit ${row.title}`
                    }
                    title={isFileRow(row) ? 'Rename' : 'Edit'}
                    onClick={() =>
                      isFileRow(row) ? setRenaming(row) : void openEdit(row)
                    }
                  >
                    <SquarePen size={16} aria-hidden="true" />
                  </Button>
                )}
                {canManageRows && caps.canAppend && !isFileRow(row) && (
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
                {canManageRows && caps.canDelete && (
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
              </>
            )}
            {canPrint && caps.canDownloadPdf && runtimeState && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Export ${row.title}`}
                title="Export"
                onClick={() => setExporting(row)}
              >
                <FileDown size={16} aria-hidden="true" />
              </Button>
            )}
          </span>
        )
      : undefined;
  const renderActions = isReadOnly
    ? canPrint
      ? defaultRenderActions
      : undefined
    : host?.renderActions ?? defaultRenderActions;
  const renderAddendumActions =
    renderActions &&
    ((addendum: DocumentListDocument) =>
      renderActions(addendum, getRowCapabilities(addendum)));

  const sharedGridProps = {
    columns: submissionMetadata ? submissionColumns : columns,
    submissionMetadata,
    renderActions,
    getRowCapabilities,
    formatCell: presenceFormatCell,
    onRowClick: host?.onRowClick,
    onRowDoubleClick: host?.onRowDoubleClick,
  };
  const recordView = (row: DocumentListDocument) =>
    form.getState().appendActivity({
      fieldId: field.definition.id,
      question: title,
      category: 'Viewed',
      detail: `${row.title} (${row.id}), rev ${row.rev ?? 0}`,
    });
  const detailRenderer =
    host?.renderDetailRow ??
    (runtimeState
      ? (row: DocumentListDocument) => {
          const addenda = addendaByOriginal.get(row.id);
          return (
            <DocumentListDetailRow
              document={row}
              runtime={runtimeState}
              historyHref={host?.documentHref?.(row) ?? undefined}
              onViewed={() => recordView(row)}
              related={
                submissionMetadata
                  ? undefined
                  : rows.filter(
                      (candidate) => candidate.linkedTo?.id === row.id
                    )
              }
              renderContent={
                alignDetailPreview
                  ? (content) => (
                      <DocumentListNotePreview
                        addenda={
                          addenda && (
                            <DocumentListAddendaPreview
                              addenda={addenda}
                              runtime={runtimeState}
                              onViewed={recordView}
                              documentHref={host?.documentHref}
                              renderDocumentActions={renderAddendumActions}
                            />
                          )
                        }
                      >
                        {content}
                      </DocumentListNotePreview>
                    )
                  : undefined
              }
            />
          );
        }
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
      }${
        alignDetailPreview && !host?.renderDetailRow
          ? ' document-list-field--branch-details'
          : ''
      }`}
      aria-label={title}
      {...dropHandlers}
    >
      <DocumentListGrid
        {...sharedGridProps}
        rows={gridRows}
        title={title}
        noun={noun}
        titleActions={titleActions}
        renderDetailRow={detailRenderer}
        detailRowsExpanded={gridDetailRowsExpanded}
        onToggleDetails={handleToggleDetails}
        onCompose={handleCompose}
        onUpload={handleUpload}
        loading={
          host?.loading === true || runtimeState?.syncStatus === 'loading'
        }
        error={editError ?? runtimeState?.error ?? host?.error}
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
      {exporting && runtimeState && (
        <DocumentListPdfPreview
          document={exporting}
          runtime={runtimeState}
          onClose={() => setExporting(null)}
          onReady={() =>
            form.getState().appendActivity({
              fieldId: field.definition.id,
              question: title,
              category: 'Export opened',
              detail: `${exporting.title} (${exporting.id})`,
            })
          }
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
