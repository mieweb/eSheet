import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  /** The shared draft this session edits (ED.36/37); absent when composing new. */
  readonly documentDraft?: DocumentDraft;
  /** The row the shared draft revises. */
  readonly documentId?: string;
  /** This session appends (ED.41): the panel offers the two shapes. */
  readonly append?: boolean;
  /** Definition-tier prefill from the last saved revision (ED.40). */
  readonly definitionPrefill?: DefinitionPrefill;
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
    initialFile?: File;
    /** Prefill for the compose draft (e.g. the head revision, ED.40). */
    draft?: DocumentListComposeDraft;
  }) => void;
  readonly setMode: (mode: DocumentListWorkflowMode) => void;
  readonly setDraft: (draft: DocumentListComposeDraft) => void;
  readonly close: () => void;
}

const ComposerSessionContext = createContext<ComposerSessionValue | null>(null);

function sessionIsDirty(session: ComposerSession): boolean {
  if (session.kind !== 'compose') return false;
  return isComposeDraftDirty(
    session.draft,
    composeDefaultDocType(session.config.docTypes)
  );
}

/**
 * One live composer at a time. The state lives here — above the pages
 * navigator — so leaving the tab that started the draft cannot destroy it.
 */
export function useComposerSessionValue(): ComposerSessionValue {
  const [session, setSession] = useState<ComposerSession | null>(null);
  const nextIdRef = useRef(0);

  return useMemo<ComposerSessionValue>(
    () => ({
      session,
      open: ({
        kind,
        fieldId,
        runtime,
        config,
        documentDraft,
        documentId,
        append,
        definitionPrefill,
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
    [session]
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
  const { session, setMode, setDraft, close } = value;
  if (!session) {
    return null;
  }

  const { config } = session;
  // The panels portal themselves (via @mieweb/ui's DockablePanel), so this
  // renders them in place and lets the shell decide where they land.
  return session.kind === 'compose' ? (
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
      mode={session.mode}
      onModeChange={setMode}
      draft={session.draft}
      onDraftChange={setDraft}
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
}

export function ComposerSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const value = useComposerSessionValue();
  return (
    <ComposerSessionContext.Provider value={value}>
      {children}
      <ComposerSessionOverlay value={value} />
    </ComposerSessionContext.Provider>
  );
}
