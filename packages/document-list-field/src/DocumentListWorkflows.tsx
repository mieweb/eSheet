import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { AssetLoad } from '@kerebron/editor';
import { Button, DockablePanel, Input, MarkdownRenderer } from '@mieweb/ui';
import { RichEditor, type RichEditorHandle } from '@mieweb/ui/kerebron';
import '@mieweb/ui/kerebron.css';
import '@mieweb/ui/markdown.css';
import type {
  DocumentListContent,
  DocumentListContentInput,
  DocumentListRuntimeState,
} from './document-list-runtime.js';
import { DOCUMENT_LIST_DEFAULT_NOUN, DOCUMENT_LIST_MARKDOWN_TYPE } from './data.js';
import {
  DocumentListDefinitionForm,
  answerText,
  type DocumentListDefinitionFormHandle,
} from './DocumentListDefinitionForm.js';
import { createMdy, mdyBody } from './mdy.js';
import {
  docTypeSerialization,
  DOCUMENT_LIST_MDY_TYPE,
  priorRevisionOf,
} from './data.js';
import type { DocumentDraft, DraftBodyRoom } from './draftChannel.js';
import type { DefinitionPrefill } from './ComposerSession.js';
import type {
  DocumentListAuthor,
  DocumentListComposeDraft,
  DocumentListDocTypeOption,
  DocumentListDocument,
  DocumentListWorkflowMode,
  DocumentRevision,
} from './types.js';

const COMPOSE_CONTENT_TYPE = DOCUMENT_LIST_MARKDOWN_TYPE;

let composeAssetLoad: AssetLoad | undefined;

export function configureDocumentListComposeEditor(options: {
  assetLoad: AssetLoad;
}): void {
  composeAssetLoad = options.assetLoad;
}

/**
 * Only what is specific to this composer — the kerebron/mieweb theme bridge
 * lives in `@mieweb/ui/kerebron.css`, imported above.
 */
const COMPOSE_EDITOR_STYLES = `
  .document-list-compose-editor .ProseMirror {
    min-height: 160px;
    outline: none;
    padding: 8px 12px;
  }

  .document-list-compose-editor .kb-editor,
  .document-list-compose-editor .ProseMirror {
    color: var(--kb-color-text);
  }

  .document-list-compose-editor .ProseMirror h1 {
    font-size: 2em;
    font-weight: bold;
    margin: 0.67em 0;
  }

  .document-list-compose-editor .ProseMirror h2 {
    font-size: 1.5em;
    font-weight: bold;
    margin: 0.75em 0;
  }

  .document-list-compose-editor .ProseMirror h3 {
    font-size: 1.17em;
    font-weight: bold;
    margin: 0.83em 0;
  }

  .document-list-compose-editor .ProseMirror ul {
    list-style: disc;
    padding-left: 1.5em;
  }

  .document-list-compose-editor .ProseMirror ol {
    list-style: decimal;
    padding-left: 1.5em;
  }

  .document-list-compose-editor .ProseMirror blockquote {
    border-left: 3px solid var(--kb-color-border);
    color: var(--kb-color-text-muted);
    margin-left: 0;
    padding-left: 1em;
  }

  .document-list-compose-editor .kb-custom-menu__editor {
    max-height: 300px;
    overflow-y: auto;
  }
`;

if (
  typeof document !== 'undefined' &&
  !document.getElementById('document-list-compose-editor-styles')
) {
  const style = document.createElement('style');
  style.id = 'document-list-compose-editor-styles';
  style.textContent = COMPOSE_EDITOR_STYLES;
  document.head.appendChild(style);
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
  /** This panel appends (ED.41): the author picks one of the two shapes. */
  readonly appendMode?: boolean;
  /** Definition-tier prefill parsed from the last saved revision (ED.40). */
  readonly definitionPrefill?: DefinitionPrefill;
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function createDocumentId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return (
    randomUuid ??
    `document-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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

type DocumentListComposeEditorHandle = RichEditorHandle;

/** Thin adapter: the editor itself is `@mieweb/ui`'s `RichEditor`. */
const DocumentListComposeEditor = forwardRef<
  DocumentListComposeEditorHandle,
  DocumentListComposeEditorProps
>(function DocumentListComposeEditor(
  { ariaLabel, disabled, id, labelledBy, onChange, value, collab },
  ref
): React.JSX.Element {
  return (
    <RichEditor
      ref={ref}
      id={id}
      className="document-list-compose-editor"
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      assetLoad={composeAssetLoad}
      collab={
        collab
          ? {
              room: collab.room,
              wsUrl: collab.wsUrl,
              params: { ...collab.params },
              user: collab.user ? { ...collab.user } : undefined,
            }
          : undefined
      }
    />
  );
});

export interface DocumentListWorkflowShellProps {
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly mode?: DocumentListWorkflowMode;
  /** Supplying this makes the panel dockable; omitting it keeps it modal. */
  readonly onModeChange?: (mode: DocumentListWorkflowMode) => void;
  /** Whether the draft holds work the user would mind losing. */
  readonly dirty?: boolean;
  /** What the dock strip says about the draft while collapsed. */
  readonly dockSummary?: ReactNode;
}

/**
 * Thin adapter: the shell is `@mieweb/ui`'s `DockablePanel`. The workflow
 * forms own the viewport while `full` and collapse to a dock strip that keeps
 * the draft — and the editor — alive while `docked`.
 */
export function DocumentListWorkflowPanel({
  onClose,
  title,
  children,
  mode = 'full',
  onModeChange,
  dirty = false,
  dockSummary,
}: DocumentListWorkflowShellProps): React.JSX.Element {
  return (
    <DockablePanel
      title={title}
      mode={mode}
      onModeChange={onModeChange}
      onClose={onClose}
      dirty={dirty}
      dockSummary={dockSummary}
      discardMessage={`Discard this ${title}?`}
      className="document-list-workflow-panel"
    >
      {children}
    </DockablePanel>
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
  appendMode,
  definitionPrefill,
  mode = 'full',
  onModeChange,
  draft,
  onDraftChange,
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
  const [appendShape, setAppendShape] = useState<'revision' | 'linked'>('revision');
  const editorRef = useRef<DocumentListComposeEditorHandle>(null);
  const definitionRef = useRef<DocumentListDefinitionFormHandle>(null);
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const activeDraft = draft ?? localDraft;
  const selectedType = docTypes?.find(
    (option) => option.id === activeDraft.docType
  );
  // A type that carries a form owns the whole compose body; without one the
  // panel stays on the note tier it has always been. A draft opened from a
  // head with no front matter says `meta:tier: note` (ED.40's parse-failure
  // rule) — the legacy body revises as a note, for opener and joiners alike.
  const definition =
    documentDraft?.getAnswers()['meta:tier'] === 'note'
      ? undefined
      : selectedType?.definition;
  // Title is asked like subject/docType: a field whose columns don't carry it
  // (e.g. case notes — the note *is* the content) composes without one, and
  // the save titles the row after its document type.
  const asksTitle = asks(fields, 'title');
  const asksSubject = asks(fields, 'subject');
  const asksDocType = asks(fields, 'docType');
  const dirty = definition
    ? definitionDirty || activeDraft.docType !== defaultDocType
    : isComposeDraftDirty(activeDraft, defaultDocType);
  const requiredLabels = [
    ...(asksTitle ? ['Title'] : []),
    ...(asksSubject ? ['Subject'] : []),
    ...(asksDocType ? ['Document type'] : []),
  ];

  const activeDraftRef = useRef(activeDraft);
  activeDraftRef.current = activeDraft;

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
            renderError instanceof Error ? renderError.message : String(renderError)
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
      const patch: Partial<DocumentListComposeDraft> = {};
      for (const key of META_KEYS) {
        const value = answers[`meta:${key}`];
        if (typeof value === 'string' && value !== activeDraftRef.current[key]) {
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
    const prior = documentId ? runtime.documents[documentId] : undefined;
    const asLinked = appendMode && appendShape === 'linked';
    const inline =
      prior && !asLinked
        ? prior.body != null // a revision never changes the row's tier
        : selectedType?.inline ?? defaultInline ?? false;
    const id = prior && !asLinked ? prior.id : createDocumentId();
    const document: DocumentListDocument =
      prior && !asLinked
        ? {
            ...prior,
            ...row,
            date: row.date ?? today(),
            // Whoever saves owns the revision.
            ...(author ? { author } : {}),
            rev: (prior.rev ?? 0) + 1,
            action: appendMode ? 'append' : content.trim() ? 'edit' : 'blank',
            ...(inline
              ? {
                  body: content,
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
            ...(inline ? { body: content } : {}),
          };
    // An inline type keeps its prose on the row, so there is nothing for
    // the repository to store.
    await runtime.saveDocument(
      document,
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
      await save(
        projected,
        // ED.45 — a type that opted out of front matter saves only the body.
        docTypeSerialization(selectedType) === 'mdy'
          ? createMdy(collected.frontMatter, collected.body)
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

  const docTypeLabel =
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
      mode={mode}
      onModeChange={onModeChange ? handleModeChange : undefined}
      dirty={dirty}
      dockSummary={
        <>
          <span className="document-list-workflow-dock__title">
            {activeDraft.title.trim() || `Untitled ${noun}`}
          </span>
          {asksDocType && docTypeLabel && (
            <span className="document-list-workflow-dock__type">
              {docTypeLabel}
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
      <form
        className="document-list-workflow-panel__form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="document-list-workflow-panel__body">
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
                onChange={(event) => updateDraft({ title: event.target.value })}
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
                // Native select, but wearing @mieweb/ui's Select slots so
                // condensed/touch density reaches it like it does the Inputs.
                <div
                  className="document-list-workflow__field"
                  data-slot="select-wrapper"
                >
                  <label
                    htmlFor={inputId(inputPrefix, 'compose-type')}
                    data-slot="select-label"
                  >
                    Document type
                  </label>
                  <select
                    id={inputId(inputPrefix, 'compose-type')}
                    className="document-list-workflow__select"
                    data-slot="select-trigger"
                    value={activeDraft.docType}
                    onChange={(event) =>
                      updateDraft({ docType: event.target.value })
                    }
                    disabled={saving}
                    required
                  >
                    {docTypes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label ?? option.id}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <Input
                  id={inputId(inputPrefix, 'compose-type')}
                  label="Document type"
                  value={activeDraft.docType}
                  onChange={(event) =>
                    updateDraft({ docType: event.target.value })
                  }
                  disabled={saving}
                  required
                />
              ))}
          </div>
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
                  initialBody={definitionPrefill?.body ?? templateBody ?? undefined}
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
                    documentDraft && !documentDraft.isNew ? '' : activeDraft.note
                  }
                  onChange={(note) => updateDraft({ note })}
                  disabled={saving}
                  collab={documentDraft?.body}
                />
              </>
            )}
          </div>
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
            disabled={saving || remoteDiscard}
          >
            {saving ? 'Saving…' : `Save ${noun}`}
          </Button>
        </div>
      </form>
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
}: DocumentListWorkflowPanelProps): React.JSX.Element | null {
  const [file, setFile] = useState<File | null>(null);
  const [storedName, setStoredName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = (): void => {
    setFile(null);
    setStoredName('');
    resetFormState(setError, setSaving);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && !saving) reset();
    onOpenChange(nextOpen);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setStoredName(selectedFile?.name ?? '');
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedStoredName = storedName.trim();
    if (!file || !trimmedStoredName) {
      setError('Choose a file and enter a stored filename.');
      return;
    }
    if (maxFileSize != null && file.size > maxFileSize) {
      setError(`File is larger than the ${maxFileSize} byte limit.`);
      return;
    }

    const id = createDocumentId();
    const contentType = file.type || 'application/octet-stream';
    const content: DocumentListContentInput = {
      content: file,
      contentType,
      size: file.size,
    };
    const document: DocumentListDocument = {
      id,
      date: today(),
      title: file.name,
      subject: 'Uploaded document',
      docType: contentType,
      docId: id,
      source: 'Upload',
      file: trimmedStoredName,
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
          <Input
            id={inputId(inputPrefix, 'upload-file')}
            label="Choose a file"
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={saving}
          />
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
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
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
}

function DocumentListMarkdownPreview({
  content,
}: {
  readonly content: string;
}): React.JSX.Element {
  return (
    <div className="document-list-detail__preview" aria-label="Document content">
      {/* Front matter is data, not prose: the reader sees the body only. */}
      <MarkdownRenderer text={mdyBody(content)} />
    </div>
  );
}

export function DocumentListDetailRow({
  document,
  runtime,
  related,
  historyHref,
}: DocumentListDetailRowProps): React.JSX.Element {
  const [content, setContent] = useState<DocumentListContent | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setContent(undefined);
    setLoading(true);
    setError(null);
    void runtime
      .loadContent(document.id)
      .then((loadedContent) => {
        if (!active) return;
        setContent(loadedContent);
        setLoading(false);
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
  }, [document.id, runtime]);

  const isImage = Boolean(
    content?.reference &&
      content.contentType?.toLowerCase().startsWith('image/')
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
        />
      )}
      {!loading && !error && content?.text == null && !isImage && (
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
