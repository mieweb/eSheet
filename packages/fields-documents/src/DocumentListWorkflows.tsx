import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  configureRichTextField,
  KerebronEditor,
  type KerebronEditorHandle,
} from '@esheet/field-kerebron';
import {
  FeedbackModal,
  fileMatchesAccept,
  formatFileSize,
  getFileMetadata,
} from '@esheet/fields';
import { Button, Input, MarkdownRenderer, Select } from '@mieweb/ui';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { FileInput } from '@esheet/core';
import '@mieweb/ui/markdown.css';
import type {
  DocumentListContent,
  DocumentListRuntimeState,
  DocumentListSaveCategory,
} from './document-list-runtime.js';
import {
  createDocumentId,
  docTypeSerialization,
  DOCUMENT_LIST_DEFAULT_NOUN,
  DOCUMENT_LIST_MARKDOWN_TYPE,
  DOCUMENT_LIST_MDY_TYPE,
  priorRevisionOf,
  today,
} from './data.js';
import {
  DocumentListDefinitionForm,
  answerText,
  type DocumentListDefinitionFormHandle,
} from './DocumentListDefinitionForm.js';
import {
  createMdy,
  mdyBody,
  normalizeKerebronTables,
  updateMdyForm,
} from './mdy.js';
import type { DocumentDraft, DraftBodyRoom } from './draftChannel.js';
import type { DefinitionPrefill } from './ComposerSession.js';
import type {
  DocumentListAuthor,
  DocumentListComposeDraft,
  DocumentListDocTypeOption,
  DocumentListDocument,
  DocumentListWorkflowMode,
} from './types.js';

const COMPOSE_CONTENT_TYPE = DOCUMENT_LIST_MARKDOWN_TYPE;
const DocumentListPdfViewer = lazy(() =>
  import('./DocumentListPdfPreview.js').then((module) => ({
    default: module.DocumentListPdfViewer,
  }))
);

function useSaveCategory(
  config: DocumentListSaveCategory | undefined,
  open: boolean,
  docType: string,
  existing: string | undefined,
  saving: boolean,
  id: string
) {
  const [options, setOptions] = useState<
    readonly { id: string; label: string }[]
  >([]);
  const [selected, setSelected] = useState('');
  const [loadedType, setLoadedType] = useState<string>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setSelected('');
    setLoadedType(undefined);
    setOptions([]);
    setError(undefined);
    if (!config || !open || existing) return;
    const controller = new AbortController();
    void config.loadOptions(docType, controller.signal).then(
      (choices) => {
        if (controller.signal.aborted) return;
        setOptions(choices);
        setSelected(choices.length === 1 ? choices[0].id : '');
        setLoadedType(docType);
        if (!choices.length) setError(config.empty);
      },
      (failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof Error ? failure.message : String(failure)
          );
        }
      }
    );
    return () => controller.abort();
  }, [config, open, docType, existing, attempt]);
  const value = existing ?? (loadedType === docType ? selected : '');
  const loading = !existing && loadedType !== docType && !error;
  return {
    value,
    ready: !config || Boolean(value),
    field: config && (
      <div className="document-list-workflow__field">
        {existing ? (
          <Input
            id={id}
            label={config.label}
            helperText={config.hint}
            value={existing}
            readOnly
          />
        ) : (
          <Select
            id={id}
            label={config.label}
            helperText={config.hint}
            value={value}
            onValueChange={setSelected}
            placeholder={loading ? config.loading : config.placeholder}
            options={options.map((option) => ({
              value: option.id,
              label:
                option.label === option.id
                  ? option.label
                  : `${option.label} (${option.id})`,
            }))}
            disabled={config.readOnly || saving || loading || Boolean(error)}
            required
          />
        )}
        {loading && (
          <p className="document-list-workflow__hint" role="status">
            {config.loading}
          </p>
        )}
        {error && (
          <>
            <p className="document-list-workflow__error" role="alert">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttempt((value) => value + 1)}
              disabled={saving}
            >
              {config.retry}
            </Button>
          </>
        )}
      </div>
    ),
  };
}

export function configureDocumentListComposeEditor(
  options: Parameters<typeof configureRichTextField>[0]
): void {
  configureRichTextField(options);
}

export interface DocumentListWorkflowPanelProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly runtime: DocumentListRuntimeState;
  readonly inputPrefix: string;
  /** What one row is called, lowercase; defaults to `document`. */
  readonly noun?: string;
  /** Column field names the list shows; the compose form asks for those. */
  readonly fields?: readonly string[];
  /** Types the field offers; the compose form falls back to free text. */
  readonly docTypes?: readonly DocumentListDocTypeOption[];
  /** Compose inline unless the chosen `docType` says otherwise. */
  readonly defaultInline?: boolean;
  /** `accept` for the upload file input. */
  readonly accept?: string;
  /** Largest upload accepted, in bytes. */
  readonly maxFileSize?: number;
  /** A file dropped on the list arrives pre-selected. */
  readonly initialFile?: File;
  /** Stamped as `author` onto rows this panel saves; absent = unattributed. */
  readonly author?: DocumentListAuthor;
  /** Renders a doc type's body template (ED.33); host-supplied and lazy. */
  readonly renderTemplate?: (
    template: string,
    mergeContext: Readonly<Record<string, string>>
  ) => Promise<string>;
  /**
   * The shared draft this panel edits (ED.37). The body binds to its room,
   * note-tier meta and definition answers bind to its answers map, and
   * closing the panel leaves the draft intact for whoever else is in it.
   */
  readonly documentDraft?: DocumentDraft;
  /** The row `documentDraft` revises; a draft without one composes new. */
  readonly documentId?: string;
  readonly revisionBase?: DocumentListDocument;
  /** This panel appends (ED.41): the author picks one of the two shapes. */
  readonly appendMode?: boolean;
  /** Definition-tier prefill parsed from the last saved revision (ED.40). */
  readonly definitionPrefill?: DefinitionPrefill;
  /** Keep a definition-backed legacy revision on the note tier. */
  readonly noteTier?: boolean;
  /** Full-screen unless the owner has collapsed the panel to the dock. */
  readonly mode?: DocumentListWorkflowMode;
  /** Supplying this makes the panel dockable; omitting it keeps it modal. */
  readonly onModeChange?: (mode: DocumentListWorkflowMode) => void;
  /**
   * The draft to edit. Uncontrolled when omitted, so a panel rendered without
   * a composer session still works.
   */
  readonly draft?: DocumentListComposeDraft;
  readonly onDraftChange?: (draft: DocumentListComposeDraft) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

/** Compose asks for the columns the list shows — title included, so a field
 * whose columns drop it composes title-less (the save titles rows by type). */
function asks(fields: readonly string[] | undefined, name: string): boolean {
  return !fields || fields.includes(name);
}

/** Note-tier meta shared through the draft's answers map, as `meta:<key>`. */
const META_KEYS = ['title', 'subject', 'docType'] as const;

function requiredMessage(labels: readonly string[]): string {
  if (labels.length === 1) return `${labels[0]} is required.`;
  return `${labels.slice(0, -1).join(', ')} and ${
    labels[labels.length - 1]
  } are required.`;
}

function contentSize(content: string | Blob): number {
  return typeof content === 'string' ? new Blob([content]).size : content.size;
}

function inputId(prefix: string, purpose: string): string {
  return `${prefix}-${purpose}`;
}

function resetFormState(
  setError: (value: string | null) => void,
  setSaving: (value: boolean) => void
): void {
  setError(null);
  setSaving(false);
}

export function emptyComposeDraft(
  defaultDocType: string
): DocumentListComposeDraft {
  return { title: '', subject: '', docType: defaultDocType, note: '' };
}

/**
 * One definition of "dirty", shared by Escape handling, the unload guard, the
 * dock's unsaved dot and the session's reopen guard.
 */
export function isComposeDraftDirty(
  draft: DocumentListComposeDraft,
  defaultDocType: string
): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.subject.trim() ||
      draft.note.trim() ||
      draft.docType !== defaultDocType
  );
}

export function composeDefaultDocType(
  docTypes: readonly DocumentListDocTypeOption[] | undefined
): string {
  return docTypes?.[0]?.id ?? 'Note';
}

interface DocumentListComposeEditorProps {
  readonly ariaLabel: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly labelledBy: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
  /** Joins the draft's shared body; the CRDT owns the content when set. */
  readonly collab?: DraftBodyRoom;
}

type DocumentListComposeEditorHandle = KerebronEditorHandle;

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const DocumentListComposeEditor = forwardRef<
  DocumentListComposeEditorHandle,
  DocumentListComposeEditorProps
>(function DocumentListComposeEditor(
  { ariaLabel, disabled, id, labelledBy, onChange, value },
  ref
): React.JSX.Element {
  return (
    <KerebronEditor
      ref={ref}
      id={id}
      className="document-list-compose-editor"
      ariaLabel={ariaLabel}
      labelledBy={labelledBy}
      disabled={disabled}
      minHeight={160}
      value={value}
      onChange={onChange}
    />
  );
});

export interface DocumentListWorkflowShellProps {
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode | ((requestClose: () => void) => ReactNode);
  readonly size?: 'md' | 'xl';
  readonly mode?: DocumentListWorkflowMode;
  /** Supplying this makes the panel dockable; omitting it keeps it modal. */
  readonly onModeChange?: (mode: DocumentListWorkflowMode) => void;
  /** Whether the draft holds work the user would mind losing. */
  readonly dirty?: boolean;
  /** What the dock strip says about the draft while collapsed. */
  readonly dockSummary?: ReactNode;
}

export function DocumentListWorkflowPanel({
  onClose,
  title,
  children,
  size = 'md',
  mode = 'full',
  onModeChange,
  dirty = false,
  dockSummary,
}: DocumentListWorkflowShellProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const [discardRequested, setDiscardRequested] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dockable = Boolean(onModeChange);
  const docked = dockable && mode === 'docked';

  const requestClose = (): void => {
    if (dirty) {
      setDiscardRequested(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (
        panelRef.current?.querySelector(
          '[role="combobox"][aria-expanded="true"]'
        )
      )
        return;
      if (dockable && dirtyRef.current && modeRef.current === 'full') {
        onModeChangeRef.current?.('docked');
        return;
      }
      if (dirtyRef.current) {
        setDiscardRequested(true);
        return;
      }
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleEscape);
    panelRef.current
      ?.querySelector<HTMLElement>('input, select, textarea, [role="combobox"]')
      ?.focus();
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dockable]);

  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || docked) return;
    const root = panel.closest('.document-list-workflow-dock') ?? panel;
    const inerted = Array.from(panel.ownerDocument.body.children).filter(
      (child) =>
        child !== root && !child.contains(root) && !child.hasAttribute('inert')
    );
    for (const element of inerted) element.setAttribute('inert', '');
    return () => {
      for (const element of inerted) element.removeAttribute('inert');
    };
  }, [docked]);

  useEffect(() => {
    if (!docked) return;
    panelRef.current
      ?.querySelector<HTMLElement>('[aria-label="Restore"]')
      ?.focus();
  }, [docked]);

  const handleTabTrap = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || docked) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((element) => element.offsetParent !== null || element === panel);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = panel.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {!docked && (
        <div className="document-list-workflow-scrim" aria-hidden="true" />
      )}
      <div
        className={`document-list-workflow-dock document-list-workflow-dock--${size} document-list-workflow-dock--${
          docked ? 'docked' : 'full'
        }`}
      >
        <div
          ref={panelRef}
          className={`document-list-workflow-panel document-list-workflow-panel--${
            docked ? 'docked' : 'full'
          }`}
          role="dialog"
          aria-modal={docked ? undefined : true}
          aria-expanded={dockable ? !docked : undefined}
          aria-label={title}
          onKeyDown={handleTabTrap}
        >
          <div className="document-list-workflow-panel__header">
            {docked ? (
              <div className="document-list-workflow-dock__summary">
                {dockSummary ?? title}
              </div>
            ) : (
              <h3 className="document-list-workflow-panel__title">{title}</h3>
            )}
            <div className="document-list-workflow-panel__header-actions">
              {dockable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onModeChange?.(docked ? 'full' : 'docked')}
                  aria-label={docked ? 'Restore' : 'Collapse to dock'}
                  aria-expanded={!docked}
                  title={docked ? 'Restore' : 'Collapse to dock'}
                >
                  {docked ? (
                    <Maximize2 size={16} aria-hidden="true" />
                  ) : (
                    <Minimize2 size={16} aria-hidden="true" />
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={requestClose}
                aria-label={docked ? 'Discard' : 'Close'}
                title={docked ? 'Discard' : 'Close'}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="document-list-workflow-panel__content">
            {typeof children === 'function' ? children(requestClose) : children}
          </div>
        </div>
        <FeedbackModal
          open={discardRequested}
          title="Discard draft?"
          message={`Discard this ${title}?`}
          variant="warning"
          showCancel
          cancelLabel="Keep editing"
          confirmLabel="Discard draft"
          onClose={() => setDiscardRequested(false)}
          onConfirm={() => {
            setDiscardRequested(false);
            onClose();
          }}
        />
      </div>
      <p className="document-list-workflow__announcer" aria-live="polite">
        {docked ? `${title} collapsed to dock` : ''}
      </p>
    </>
  );
}

export function DocumentListComposePanel({
  open,
  onOpenChange,
  runtime,
  inputPrefix,
  noun = DOCUMENT_LIST_DEFAULT_NOUN,
  fields,
  docTypes,
  defaultInline,
  author,
  renderTemplate,
  documentDraft,
  documentId,
  revisionBase,
  appendMode,
  definitionPrefill,
  noteTier,
  mode = 'full',
  onModeChange,
  draft,
  onDraftChange,
  onDirtyChange,
}: DocumentListWorkflowPanelProps): React.JSX.Element | null {
  const defaultDocType = composeDefaultDocType(docTypes);
  const [localDraft, setLocalDraft] = useState<DocumentListComposeDraft>(
    () => draft ?? emptyComposeDraft(defaultDocType)
  );
  // `saving` and `error` stay local: the panel outlives navigation now, and
  // neither survives a save attempt worth reporting to the dock.
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // ED.41 — the author picks the addendum's shape; both are legitimate.
  const [appendShape, setAppendShape] = useState<'revision' | 'linked'>(
    'revision'
  );
  const editorRef = useRef<DocumentListComposeEditorHandle>(null);
  const definitionRef = useRef<DocumentListDefinitionFormHandle>(null);
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const activeDraft = draft ?? localDraft;
  const savedCategory =
    documentId && !(appendMode && appendShape === 'linked')
      ? runtime.documents[documentId]?.nativeDocType
      : undefined;
  const category = useSaveCategory(
    runtime.saveCategory,
    open,
    activeDraft.docType,
    savedCategory,
    saving,
    inputId(inputPrefix, 'compose-category')
  );
  const selectedType = docTypes?.find(
    (option) => option.id === activeDraft.docType
  );
  // A type that carries a form owns the whole compose body; without one the
  // panel stays on the note tier it has always been. A draft opened from a
  // head with no front matter says `meta:tier: note` (ED.40's parse-failure
  // rule) — the legacy body revises as a note, for opener and joiners alike.
  const definition =
    noteTier || documentDraft?.getAnswers()['meta:tier'] === 'note'
      ? undefined
      : selectedType?.definition;
  // Title is asked like subject/docType: a field whose columns don't carry it
  // (e.g. case notes — the note *is* the content) composes without one, and
  // the save titles the row after its document type.
  const asksTitle = asks(fields, 'title');
  const asksSubject = asks(fields, 'subject');
  const asksDocType = asks(fields, 'docType');
  const docTypeLabel = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} Type`;
  const dirty = definition
    ? definitionDirty || activeDraft.docType !== defaultDocType
    : isComposeDraftDirty(activeDraft, defaultDocType);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const requiredLabels = [
    ...(asksTitle ? ['Title'] : []),
    ...(asksSubject ? ['Subject'] : []),
    ...(asksDocType ? [docTypeLabel] : []),
  ];

  const activeDraftRef = useRef(activeDraft);
  activeDraftRef.current = activeDraft;
  const createId = useRef<string | undefined>(undefined);
  const baseDocument = useRef(
    revisionBase ?? (documentId ? runtime.documents[documentId] : undefined)
  );
  useEffect(() => {
    if (!open) return;
    createId.current = undefined;
    baseDocument.current =
      revisionBase ?? (documentId ? runtime.documents[documentId] : undefined);
    // A refresh while writing must not silently advance the draft's base.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  // Composing is writing: the note editor takes focus as the panel opens.
  // The definition tier focuses its own first field; title-less notes have
  // nothing else asking for the keyboard.
  useEffect(() => {
    if (!open || definition) return;
    editorRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, definition]);

  // ED.42 — somebody removed the document (or dropped the proposal) while we
  // were in it: say so and stop offering to save into a tombstone.
  const [remoteDiscard, setRemoteDiscard] = useState(false);
  useEffect(() => {
    if (!documentDraft) return;
    return documentDraft.onDiscarded(() => {
      setRemoteDiscard(true);
      setError(
        'This draft was discarded — the document was removed or the proposal dropped.'
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentDraft]);

  // ED.33 — a type that names a template gets its body prefilled once, when
  // composing new (revising starts from the saved revision instead). The
  // template renders against only what its mergeContext declares.
  const [templateBody, setTemplateBody] = useState<string | null>(null);
  const templateFor = documentId ? undefined : selectedType?.template;
  useEffect(() => {
    setTemplateBody(null);
    if (!open || !templateFor || !renderTemplate) return;
    let active = true;
    void renderTemplate(templateFor, selectedType?.mergeContext ?? {})
      .then((body) => {
        if (!active) return;
        setTemplateBody(body);
        if (!definition && !activeDraftRef.current.note.trim()) {
          updateDraft({ note: body });
        }
      })
      .catch((renderError: unknown) => {
        if (!active) return;
        // The author still gets an editor — just not a prefilled one.
        setTemplateBody('');
        setError(
          `The template could not be rendered: ${
            renderError instanceof Error
              ? renderError.message
              : String(renderError)
          }`
        );
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateFor, activeDraft.docType]);
  // The definition form applies its prefill on ready, so it must not mount
  // until the rendered template is there to apply.
  const awaitingTemplate = Boolean(
    open && templateFor && renderTemplate && definition && templateBody === null
  );

  const updateDraft = (
    patch: Partial<DocumentListComposeDraft>,
    options?: { share?: boolean }
  ): void => {
    const next = { ...activeDraftRef.current, ...patch };
    setLocalDraft(next);
    onDraftChange?.(next);
    // Note-tier meta is shared state too; the body syncs through its room.
    if (documentDraft && options?.share !== false) {
      for (const key of META_KEYS) {
        if (key in patch) documentDraft.setAnswer(`meta:${key}`, next[key]);
      }
    }
  };

  // Remote meta edits land in the local draft state; identical values are
  // dropped so our own setAnswer echoes (the channel notifies local writes
  // too) cannot ping-pong.
  useEffect(() => {
    if (!documentDraft) return;
    const apply = (answers: Readonly<Record<string, unknown>>): void => {
      const patch: Record<string, string> = {};
      for (const key of META_KEYS) {
        const value = answers[`meta:${key}`];
        if (
          typeof value === 'string' &&
          value !== activeDraftRef.current[key]
        ) {
          patch[key] = value;
        }
      }
      if (Object.keys(patch).length === 0) return;
      const next = { ...activeDraftRef.current, ...patch };
      setLocalDraft(next);
      onDraftChange?.(next);
    };
    apply(documentDraft.getAnswers());
    return documentDraft.onAnswers(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentDraft]);

  const reset = (): void => {
    // Local only: resetting the panel must never blank the shared draft.
    updateDraft(emptyComposeDraft(defaultDocType), { share: false });
    setDefinitionDirty(false);
    resetFormState(setError, setSaving);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && saving) return;
    if (!nextOpen && !saving) {
      // Leaving is not discarding: the draft stays for whoever else is in it.
      documentDraft?.close();
      reset();
    }
    onOpenChange(nextOpen);
  };

  const handleModeChange = (nextMode: DocumentListWorkflowMode): void => {
    onModeChange?.(nextMode);
    // Restoring puts the writer back where they stopped typing.
    if (nextMode === 'full') {
      setTimeout(() => editorRef.current?.focus(), 0);
    }
  };

  /**
   * One save path for both tiers and both kinds of session — a save is a
   * revision (ED.39): composing new writes rev 0; saving a draft on an
   * existing row projects it into the next head revision (an empty body is a
   * `blank` revision, never a lost row) and then clears the draft for
   * everyone. Only the place the bytes land differs by tier.
   */
  const save = async (
    row: { title: string; subject: string; docType: string; date?: string },
    content: string
  ): Promise<void> => {
    const sharedAnswers = documentDraft?.getAnswers();
    const originalBlock =
      sharedAnswers?.['meta:frontMatterSource'] ??
      activeDraft.frontMatterSource;
    const nativeVersion =
      sharedAnswers?.['meta:nativeVersion'] ?? activeDraft.nativeVersion;
    if (!definition && typeof originalBlock === 'string')
      content = originalBlock + content;
    const prior = baseDocument.current;
    const asLinked = appendMode && appendShape === 'linked';
    const inline =
      prior && !asLinked
        ? prior.inline ?? prior.body != null
        : selectedType?.inline ?? defaultInline ?? false;
    const id =
      prior && !asLinked ? prior.id : (createId.current ??= createDocumentId());
    const document: DocumentListDocument =
      prior && !asLinked
        ? {
            ...prior,
            ...row,
            ...(typeof nativeVersion === 'string' ? { nativeVersion } : {}),
            date: row.date ?? today(),
            // Whoever saves owns the revision.
            ...(author ? { author } : {}),
            rev: (prior.rev ?? 0) + 1,
            action: appendMode ? 'append' : content.trim() ? 'edit' : 'blank',
            ...(inline
              ? {
                  body: content,
                  inline: true,
                  // The superseded prose rides along in full — the case doc is
                  // the inline tier's store (ED.47 formalizes this in the port).
                  history: [...(prior.history ?? []), priorRevisionOf(prior)],
                }
              : {}),
          }
        : {
            id,
            date: row.date ?? today(),
            ...row,
            docId: id,
            source: 'Compose',
            file: `${id}.md`,
            ...(author ? { author } : {}),
            action: 'create',
            // A linked addendum leaves the original byte-identical and points
            // back at it (WebChart's documents_link).
            ...(asLinked && prior
              ? { linkedTo: { id: prior.id, linkType: 'addendum' } }
              : {}),
            ...(inline ? { body: content, inline: true } : {}),
          };
    // Inline content travels on the row; a host repository may persist it
    // and return a native reference before the runtime publishes the answer.
    await runtime.saveDocument(
      category.value
        ? { ...document, nativeDocType: category.value }
        : document,
      inline
        ? undefined
        : {
            content,
            // ED.45 — the doc type names the output; the backend maps it to
            // its own vocabulary (WebChart: storage_type 1 vs 36).
            contentType:
              docTypeSerialization(selectedType) === 'mdy'
                ? DOCUMENT_LIST_MDY_TYPE
                : COMPOSE_CONTENT_TYPE,
            size: contentSize(content),
          }
    );
    // The proposal became a revision; drop it for everyone in it.
    await documentDraft?.discard();
    reset();
    onOpenChange(false);
  };

  const submitDefinition = async (): Promise<void> => {
    const { draft: collected, errors } = definitionRef.current?.collect() ?? {
      draft: null,
      errors: [],
    };
    if (!collected) {
      setError(errors[0]?.message ?? 'This form is not ready to save yet.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // ED.31/ED.49 — the declared columns are projected from the answers;
      // everything else lives only inside the document.
      const projected: { title: string; subject: string; docType: string } & {
        date?: string;
      } = {
        title:
          answerText(collected.responses.title).trim() ||
          (selectedType?.label ?? activeDraft.docType),
        subject: answerText(collected.responses.subject).trim(),
        docType: activeDraft.docType,
      };
      const dateAnswer = answerText(collected.responses.date).trim();
      if (fields?.includes('date') && dateAnswer) projected.date = dateAnswer;
      const source =
        documentDraft?.getAnswers()['meta:frontMatterSource'] ??
        definitionPrefill?.frontMatterSource;
      await save(
        projected,
        // ED.45 — a type that opted out of front matter saves only the body.
        docTypeSerialization(selectedType) === 'mdy'
          ? typeof source === 'string' && source
            ? updateMdyForm(
                source,
                collected.frontMatter,
                collected.body,
                collected.fieldIds
              )
            : createMdy(collected.frontMatter, collected.body)
          : collected.body
      );
    } catch (saveError) {
      setSaving(false);
      setError(
        saveError instanceof Error ? saveError.message : String(saveError)
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !category.ready) return;
    if (definition) {
      await submitDefinition();
      return;
    }

    const trimmedTitle = activeDraft.title.trim();
    const trimmedSubject = activeDraft.subject.trim();
    const trimmedDocType = activeDraft.docType.trim();
    if (
      (asksTitle && !trimmedTitle) ||
      (asksSubject && !trimmedSubject) ||
      (asksDocType && !trimmedDocType)
    ) {
      setError(requiredMessage(requiredLabels));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const composedNote = editorRef.current
        ? await editorRef.current.getContent()
        : activeDraft.note;
      await save(
        {
          // Untitled rows read as their type — same rule as the definition tier.
          title:
            trimmedTitle || (selectedType?.label ?? trimmedDocType ?? noun),
          subject: trimmedSubject,
          docType: trimmedDocType,
        },
        composedNote
      );
    } catch (saveError) {
      setSaving(false);
      setError(
        saveError instanceof Error ? saveError.message : String(saveError)
      );
    }
  };

  if (!open) return null;

  const selectedDocTypeLabel =
    docTypes?.find((option) => option.id === activeDraft.docType)?.label ??
    activeDraft.docType;
  // The title says which act this is: composing new, revising, or appending.
  const revisingRow = documentId ? runtime.documents[documentId] : undefined;
  const panelTitle = revisingRow
    ? appendMode
      ? `Append to ${noun} (rev ${revisingRow.rev ?? 0})`
      : `Revise ${noun} (rev ${revisingRow.rev ?? 0})`
    : `Compose ${noun}`;

  return (
    <DocumentListWorkflowPanel
      title={panelTitle}
      onClose={() => handleOpenChange(false)}
      size="xl"
      mode={mode}
      onModeChange={onModeChange ? handleModeChange : undefined}
      dirty={dirty}
      dockSummary={
        <>
          <span className="document-list-workflow-dock__title">
            {activeDraft.title.trim() || `Untitled ${noun}`}
          </span>
          {asksDocType && selectedDocTypeLabel && (
            <span className="document-list-workflow-dock__type">
              {selectedDocTypeLabel}
            </span>
          )}
          {dirty && (
            <span
              className="document-list-workflow-dock__dot"
              role="img"
              aria-label="Unsaved changes"
            />
          )}
        </>
      }
    >
      {(requestClose) => (
        <form
          className="document-list-workflow-panel__form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="document-list-workflow-panel__body document-list-workflow-panel__body--compose">
            {appendMode && (
              <fieldset className="document-list-workflow__append-shape">
                <legend>Append as</legend>
                <label>
                  <input
                    type="radio"
                    name={inputId(inputPrefix, 'append-shape')}
                    checked={appendShape === 'revision'}
                    onChange={() => setAppendShape('revision')}
                    disabled={saving}
                  />
                  A new revision — this {noun} should now read differently
                </label>
                <label>
                  <input
                    type="radio"
                    name={inputId(inputPrefix, 'append-shape')}
                    checked={appendShape === 'linked'}
                    onChange={() => setAppendShape('linked')}
                    disabled={saving}
                  />
                  A linked {noun} — further information; the original stays
                  untouched
                </label>
              </fieldset>
            )}
            <div className="document-list-workflow-panel__meta">
              {!definition && asksTitle && (
                <Input
                  id={inputId(inputPrefix, 'compose-title')}
                  label="Title"
                  value={activeDraft.title}
                  onChange={(event) =>
                    updateDraft({ title: event.target.value })
                  }
                  disabled={saving}
                  required
                />
              )}
              {!definition && asksSubject && (
                <Input
                  id={inputId(inputPrefix, 'compose-subject')}
                  label="Subject"
                  value={activeDraft.subject}
                  onChange={(event) =>
                    updateDraft({ subject: event.target.value })
                  }
                  disabled={saving}
                  required
                />
              )}
              {asksDocType &&
                (docTypes?.length ? (
                  <Select
                    id={inputId(inputPrefix, 'compose-type')}
                    label={docTypeLabel}
                    value={activeDraft.docType}
                    onValueChange={(docType) => updateDraft({ docType })}
                    options={docTypes.map((option) => ({
                      value: option.id,
                      label: option.label ?? option.id,
                    }))}
                    disabled={saving}
                    required
                  />
                ) : (
                  <Input
                    id={inputId(inputPrefix, 'compose-type')}
                    label={docTypeLabel}
                    value={activeDraft.docType}
                    onChange={(event) =>
                      updateDraft({ docType: event.target.value })
                    }
                    disabled={saving}
                    required
                  />
                ))}
            </div>
            {category.field}
            <div className="document-list-workflow__field document-list-workflow__field--grow">
              {definition ? (
                awaitingTemplate ? (
                  <p role="status">Preparing the template…</p>
                ) : (
                  <DocumentListDefinitionForm
                    // Switching type swaps the form, and with it the store.
                    key={activeDraft.docType}
                    ref={definitionRef}
                    definition={definition}
                    docType={activeDraft.docType}
                    definitionVersion={selectedType?.definitionVersion}
                    onDirtyChange={setDefinitionDirty}
                    draft={documentDraft}
                    initialResponses={definitionPrefill?.responses}
                    initialBody={
                      definitionPrefill?.body ?? templateBody ?? undefined
                    }
                  />
                )
              ) : (
                <>
                  <label
                    id={inputId(inputPrefix, 'compose-note-label')}
                    htmlFor={inputId(inputPrefix, 'compose-note')}
                  >
                    Note
                  </label>
                  <DocumentListComposeEditor
                    ref={editorRef}
                    id={inputId(inputPrefix, 'compose-note')}
                    ariaLabel="Note"
                    labelledBy={inputId(inputPrefix, 'compose-note-label')}
                    // Joiners must not seed the shared body: only the opener's
                    // prefill loads; after that the CRDT owns the content.
                    value={
                      documentDraft && !documentDraft.isNew
                        ? ''
                        : activeDraft.note
                    }
                    onChange={(note) => updateDraft({ note })}
                    disabled={saving}
                    collab={documentDraft?.body}
                  />
                </>
              )}
            </div>
            {saving && runtime.saveCategory && (
              <p className="document-list-workflow__hint" role="status">
                {runtime.saveCategory.saving}
              </p>
            )}
            {error && (
              <p className="document-list-workflow__error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="document-list-workflow-panel__footer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || remoteDiscard || !category.ready}
            >
              {saving ? 'Saving…' : `Save ${noun}`}
            </Button>
          </div>
        </form>
      )}
    </DocumentListWorkflowPanel>
  );
}

export function DocumentListUploadPanel({
  open,
  onOpenChange,
  runtime,
  inputPrefix,
  noun = DOCUMENT_LIST_DEFAULT_NOUN,
  accept,
  maxFileSize,
  author,
  initialFile,
}: DocumentListWorkflowPanelProps): React.JSX.Element | null {
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [storedName, setStoredName] = useState(initialFile?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const uploadId = useRef<string | undefined>(undefined);
  const category = useSaveCategory(
    runtime.saveCategory,
    open,
    file ? getFileMetadata(file).contentType : 'application/octet-stream',
    undefined,
    saving,
    inputId(inputPrefix, 'upload-category')
  );

  const reset = (): void => {
    uploadId.current = undefined;
    setFile(null);
    setStoredName('');
    resetFormState(setError, setSaving);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && saving) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    uploadId.current = undefined;
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setStoredName(selectedFile?.name ?? '');
    setError(null);
  };

  const adoptFile = (dropped: File | undefined): void => {
    if (!dropped) return;
    uploadId.current = undefined;
    setFile(dropped);
    setStoredName(dropped.name);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !category.ready) return;
    const trimmedStoredName = storedName.trim();
    if (!file || !trimmedStoredName) {
      setError('Choose a file and enter a stored filename.');
      return;
    }
    if (!fileMatchesAccept(file, accept)) {
      setError(`File type not accepted: ${file.name}`);
      return;
    }
    if (maxFileSize != null && file.size > maxFileSize) {
      setError(`File is larger than the ${formatFileSize(maxFileSize)} limit.`);
      return;
    }

    const id = (uploadId.current ??= createDocumentId());
    const metadata = getFileMetadata(file);
    const content: FileInput = {
      content: file,
      contentType: metadata.contentType,
      size: metadata.size,
    };
    const document: DocumentListDocument = {
      id,
      date: today(),
      title: metadata.title,
      subject: 'Uploaded document',
      docType: metadata.contentType,
      docId: id,
      source: 'Upload',
      file: trimmedStoredName,
      ...(category.value ? { nativeDocType: category.value } : {}),
      ...(author ? { author } : {}),
    };

    setSaving(true);
    setError(null);
    try {
      await runtime.saveDocument(document, content);
      reset();
      onOpenChange(false);
    } catch (saveError) {
      setSaving(false);
      setError(
        saveError instanceof Error ? saveError.message : String(saveError)
      );
    }
  };

  if (!open) return null;

  return (
    <DocumentListWorkflowPanel
      title={`Upload ${noun}`}
      onClose={() => handleOpenChange(false)}
    >
      <form
        className="document-list-workflow-panel__form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="document-list-workflow-panel__body">
          <div
            className={`document-list-upload__dropzone${
              dragActive ? ' document-list-upload__dropzone--active' : ''
            }`}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (!saving) adoptFile(event.dataTransfer.files?.[0]);
            }}
          >
            <Input
              id={inputId(inputPrefix, 'upload-file')}
              label="Choose a file"
              type="file"
              accept={accept}
              onChange={handleFileChange}
              disabled={saving}
            />
            <p className="document-list-upload__dropzone-hint">
              …or drag and drop a file here
            </p>
          </div>
          {file && (
            <p className="document-list-workflow__hint">
              Title: {file.name} · Type:{' '}
              {file.type || 'application/octet-stream'}
            </p>
          )}
          <Input
            id={inputId(inputPrefix, 'upload-filename')}
            label="Stored filename"
            value={storedName}
            onChange={(event) => setStoredName(event.target.value)}
            disabled={saving || !file}
            required
          />
          {category.field}
          {file && !saving && !error && runtime.saveCategory && (
            <p className="document-list-workflow__hint" role="status">
              {runtime.saveCategory.pending}
            </p>
          )}
          {saving && runtime.saveCategory && (
            <p className="document-list-workflow__hint" role="status">
              {runtime.saveCategory.saving}
            </p>
          )}
          {error && (
            <p className="document-list-workflow__error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="document-list-workflow-panel__footer">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving || !category.ready}
          >
            {saving ? 'Saving…' : `Save ${noun}`}
          </Button>
        </div>
      </form>
    </DocumentListWorkflowPanel>
  );
}

export interface DocumentListDetailRowProps {
  readonly document: DocumentListDocument;
  readonly runtime: DocumentListRuntimeState;
  /** Rows linked to this one (addenda), rendered beneath the content. */
  readonly related?: readonly DocumentListDocument[];
  /** The host's full-page document view (revision history lives there). */
  readonly historyHref?: string;
  readonly onViewed?: () => void;
}

function DocumentListMarkdownPreview({
  content,
}: {
  readonly content: string;
}): React.JSX.Element {
  return (
    <div
      className="document-list-detail__preview"
      aria-label="Document content"
    >
      {/* Front matter is data, not prose: the reader sees the body only. */}
      <MarkdownRenderer text={normalizeKerebronTables(mdyBody(content))} />
    </div>
  );
}

export function DocumentListDetailRow({
  document,
  runtime,
  related,
  historyHref,
  onViewed,
}: DocumentListDetailRowProps): React.JSX.Element {
  const [content, setContent] = useState<DocumentListContent | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loadContent } = runtime;
  const contentVersion = runtime.contentVersions?.[document.id] ?? 0;
  const refreshError =
    runtime.syncStatus === 'error' ? runtime.error : undefined;
  const viewedDocument = useRef<string | undefined>(undefined);
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;
  const recordView = useCallback(() => {
    if (viewedDocument.current === document.id) return;
    viewedDocument.current = document.id;
    onViewedRef.current?.();
  }, [document.id]);

  useEffect(() => {
    let active = true;
    setContent(undefined);
    setLoading(true);
    setError(null);
    if (refreshError) {
      setLoading(false);
      setError(refreshError);
      return;
    }
    void loadContent(document.id)
      .then((loadedContent) => {
        if (!active) return;
        setContent(loadedContent);
        setLoading(false);
        if (loadedContent?.text != null) recordView();
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setLoading(false);
        setError(
          loadError instanceof Error ? loadError.message : String(loadError)
        );
      });
    return () => {
      active = false;
    };
  }, [
    document.id,
    document.rev,
    document.nativeVersion,
    document.sha256,
    document.docId,
    document.body,
    document.fileReference?.id,
    loadContent,
    recordView,
    contentVersion,
    refreshError,
  ]);

  const isImage = Boolean(
    content?.reference &&
      content.contentType?.toLowerCase().startsWith('image/')
  );
  const isPdf = Boolean(
    (content?.blob || content?.reference) &&
      content?.contentType?.split(';')[0].trim().toLowerCase() ===
        'application/pdf'
  );
  const isMarkdown =
    (content?.contentType === COMPOSE_CONTENT_TYPE ||
      content?.contentType === DOCUMENT_LIST_MDY_TYPE) &&
    content.text != null;

  return (
    // The row is the document. Date, title, type and source are already
    // columns in the grid above, so repeating them here says nothing.
    <div className="document-list-detail">
      {loading && <p role="status">Loading document content…</p>}
      {error && (
        <p className="document-list-workflow__error" role="alert">
          Could not load document content: {error}
        </p>
      )}
      {!loading &&
        content?.text != null &&
        (isMarkdown ? (
          <DocumentListMarkdownPreview content={content.text} />
        ) : (
          <div className="document-list-detail__text">{content.text}</div>
        ))}
      {!loading && isImage && (
        <img
          className="document-list-detail__image"
          src={content?.reference}
          alt={document.title}
          onLoad={recordView}
        />
      )}
      {!loading && isPdf && (
        <div className="document-list-detail__pdf">
          <Suspense fallback={<p role="status">Loading document content…</p>}>
            <DocumentListPdfViewer
              key={`${document.id}:${contentVersion}`}
              reference={content?.reference}
              blob={content?.blob}
              title={document.title}
              onReady={recordView}
            />
          </Suspense>
        </div>
      )}
      {!loading && content?.reference && content.downloadName && (
        <a
          className="document-list-detail__download"
          href={content.reference}
          download={content.downloadName}
          aria-label={`Download original ${content.downloadName}`}
        >
          Download original file
        </a>
      )}
      {!loading && !error && content?.text == null && !isImage && !isPdf && (
        <p className="document-list-detail__empty">
          No preview for this document.
        </p>
      )}
      {related && related.length > 0 && (
        <ul className="document-list-detail__addenda" aria-label="Addenda">
          {related.map((addendum) => (
            <li key={addendum.id}>
              Addendum — {addendum.title} ({addendum.date}
              {addendum.author ? `, ${addendum.author.name}` : ''})
            </li>
          ))}
        </ul>
      )}
      {historyHref && (
        <p className="document-list-detail__history-link">
          <a href={historyHref}>
            Revision history{document.rev ? ` (rev ${document.rev})` : ''}
          </a>
        </p>
      )}
    </div>
  );
}
