import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  composeDefaultDocType,
  DocumentListComposePanel,
  DocumentListUploadPanel,
  emptyComposeDraft,
  isComposeDraftDirty,
} from './DocumentListWorkflows.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import type { DocumentDraft } from './draftChannel.js';
import type {
  DocumentListAuthor,
  DocumentListComposeDraft,
  DocumentListDocTypeOption,
  DocumentListWorkflow,
  DocumentListWorkflowMode,
} from './types.js';

/** Everything the panel needs that the field, not the session, knows. */
export interface ComposerSessionConfig {
  readonly inputPrefix: string;
  readonly noun?: string;
  readonly fields?: readonly string[];
  readonly docTypes?: readonly DocumentListDocTypeOption[];
  readonly defaultInline?: boolean;
  readonly accept?: string;
  readonly maxFileSize?: number;
  /** Stamped as `author` onto rows this session saves. */
  readonly author?: DocumentListAuthor;
  /** Renders a doc type's body template (ED.33); host-supplied and lazy. */
  readonly renderTemplate?: (
    template: string,
    mergeContext: Readonly<Record<string, string>>
  ) => Promise<string>;
}

export interface ComposerSession {
  readonly id: string;
  readonly kind: DocumentListWorkflow;
  readonly mode: DocumentListWorkflowMode;
  readonly fieldId: string;
  readonly runtime: DocumentListRuntimeState;
  readonly config: ComposerSessionConfig;
  readonly draft: DocumentListComposeDraft;
  readonly contentDirty?: boolean;
  /** The shared draft this session edits (ED.36/37); absent when composing new. */
  readonly documentDraft?: DocumentDraft;
  /** The row the shared draft revises. */
  readonly documentId?: string;
  /** This session appends (ED.41): the panel offers the two shapes. */
  readonly append?: boolean;
  /** Definition-tier prefill from the last saved revision (ED.40). */
  readonly definitionPrefill?: DefinitionPrefill;
  /** Force a definition-backed legacy revision to remain on the note tier. */
  readonly noteTier?: boolean;
  /** A file dropped on the list, handed to the upload panel pre-selected. */
  readonly initialFile?: File;
}

/** The reverse of the ED.30 save: front-matter answers plus the body prose. */
export interface DefinitionPrefill {
  readonly responses: Readonly<Record<string, unknown>>;
  readonly body: string;
}

export interface ComposerSessionValue {
  readonly session: ComposerSession | null;
  readonly open: (request: {
    kind: DocumentListWorkflow;
    fieldId: string;
    runtime: DocumentListRuntimeState;
    config: ComposerSessionConfig;
    documentDraft?: DocumentDraft;
    documentId?: string;
    append?: boolean;
    definitionPrefill?: DefinitionPrefill;
    noteTier?: boolean;
    initialFile?: File;
    /** Prefill for the compose draft (e.g. the head revision, ED.40). */
    draft?: DocumentListComposeDraft;
  }) => void;
  readonly setMode: (mode: DocumentListWorkflowMode) => void;
  readonly setDraft: (draft: DocumentListComposeDraft) => void;
  readonly setContentDirty: (dirty: boolean) => void;
  readonly close: () => void;
}

const ComposerSessionContext = createContext<ComposerSessionValue | null>(null);

function sessionIsDirty(session: ComposerSession): boolean {
  if (session.kind !== 'compose') return false;
  return (
    Boolean(session.contentDirty) ||
    isComposeDraftDirty(
      session.draft,
      composeDefaultDocType(session.config.docTypes)
    )
  );
}

/**
 * One live composer at a time. The state lives here — above the pages
 * navigator — so leaving the tab that started the draft cannot destroy it.
 */
export function useComposerSessionValue(): ComposerSessionValue {
  const [session, setSession] = useState<ComposerSession | null>(null);
  const nextIdRef = useRef(0);
  const setContentDirty = useCallback((contentDirty: boolean) => {
    setSession((current) =>
      current && current.contentDirty !== contentDirty
        ? { ...current, contentDirty }
        : current
    );
  }, []);

  return useMemo<ComposerSessionValue>(
    () => ({
      session,
      setContentDirty,
      open: ({
        kind,
        fieldId,
        runtime,
        config,
        documentDraft,
        documentId,
        append,
        definitionPrefill,
        noteTier,
        initialFile,
        draft,
      }) =>
        setSession((current) => {
          // A dirty draft is never replaced: composing again restores it.
          if (current && sessionIsDirty(current)) {
            return current.mode === 'full'
              ? current
              : { ...current, mode: 'full' };
          }
          current?.documentDraft?.close();
          nextIdRef.current += 1;
          return {
            id: `composer-${nextIdRef.current}`,
            kind,
            mode: 'full',
            fieldId,
            runtime,
            config,
            documentDraft,
            documentId,
            append,
            definitionPrefill,
            noteTier,
            initialFile,
            draft:
              draft ??
              emptyComposeDraft(composeDefaultDocType(config.docTypes)),
          };
        }),
      setMode: (mode) =>
        setSession((current) => (current ? { ...current, mode } : current)),
      setDraft: (draft) =>
        setSession((current) => (current ? { ...current, draft } : current)),
      close: () => setSession(null),
    }),
    [session, setContentDirty]
  );
}

export function useComposerSession(): ComposerSessionValue | null {
  return useContext(ComposerSessionContext);
}

/**
 * The panel is portaled to `document.body` so it escapes the renderer's scroll
 * and stacking contexts, and so page switches never unmount it.
 */
export function ComposerSessionOverlay({
  value,
}: {
  readonly value: ComposerSessionValue;
}): React.JSX.Element | null {
  const { session, setMode, setDraft, setContentDirty, close } = value;
  if (!session || typeof document === 'undefined' || !document.body) {
    return null;
  }

  const { config } = session;
  const panel =
    session.kind === 'compose' ? (
      <DocumentListComposePanel
        key={session.id}
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        runtime={session.runtime}
        inputPrefix={config.inputPrefix}
        noun={config.noun}
        fields={config.fields}
        docTypes={config.docTypes}
        defaultInline={config.defaultInline}
        author={config.author}
        renderTemplate={config.renderTemplate}
        documentDraft={session.documentDraft}
        documentId={session.documentId}
        appendMode={session.append}
        definitionPrefill={session.definitionPrefill}
        noteTier={session.noteTier}
        mode={session.mode}
        onModeChange={setMode}
        draft={session.draft}
        onDraftChange={setDraft}
        onDirtyChange={setContentDirty}
      />
    ) : (
      <DocumentListUploadPanel
        key={session.id}
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        runtime={session.runtime}
        inputPrefix={config.inputPrefix}
        noun={config.noun}
        accept={config.accept}
        maxFileSize={config.maxFileSize}
        author={config.author}
        initialFile={session.initialFile}
      />
    );

  return createPortal(panel, document.body);
}

export function ComposerSessionProvider({
  children,
  onDirtyChange,
}: {
  readonly children: ReactNode;
  readonly onDirtyChange?: (dirty: boolean, fieldId?: string) => void;
}): React.JSX.Element {
  const value = useComposerSessionValue();
  const dirty = value.session !== null && sessionIsDirty(value.session);
  const fieldId = value.session?.fieldId;
  useEffect(() => {
    onDirtyChange?.(dirty, fieldId);
    return () => onDirtyChange?.(false);
  }, [dirty, fieldId, onDirtyChange]);
  return (
    <ComposerSessionContext.Provider value={value}>
      {children}
      <ComposerSessionOverlay value={value} />
    </ComposerSessionContext.Provider>
  );
}
