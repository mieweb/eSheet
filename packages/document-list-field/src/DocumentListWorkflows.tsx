import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { CoreEditor, type AssetLoad } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@mieweb/ui';
import '@kerebron/editor/assets/index.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';
import type {
  DocumentListContent,
  DocumentListContentInput,
  DocumentListRuntimeState,
} from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

const COMPOSE_CONTENT_TYPE = 'text/x-markdown';

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return false;
    return (
      document.documentElement.classList.contains('dark') ||
      document.documentElement.dataset.theme === 'dark'
    );
  });

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = (): void => {
      setIsDark(
        root.classList.contains('dark') || root.dataset.theme === 'dark'
      );
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    updateTheme();
    return () => observer.disconnect();
  }, []);

  return isDark;
}

let composeAssetLoad: AssetLoad | undefined;

export function configureDocumentListComposeEditor(options: {
  assetLoad: AssetLoad;
}): void {
  composeAssetLoad = options.assetLoad;
}

const COMPOSE_EDITOR_STYLES = `
  [data-theme='light'],
  [data-theme='light'] .kb-component {
    --kb-color-primary: var(--mieweb-primary-500, #27aae1);
    --kb-color-text: var(--mieweb-foreground, #1f2937);
    --kb-color-text-muted: var(--mieweb-muted-foreground, #6b7280);
    --kb-color-icon: var(--mieweb-muted-foreground, #5f6368);
    --kb-color-surface: var(--mieweb-background, #ffffff);
    --kb-color-surface-elevated: var(--mieweb-muted, #f9fafb);
    --kb-color-surface-hover: rgba(60, 64, 67, 0.08);
    --kb-color-border: var(--mieweb-border, #e5e7eb);
    --kb-color-border-strong: var(--mieweb-border, #d1d5db);
    --kb-color-hover: rgba(60, 64, 67, 0.08);
    --kb-color-active: rgba(60, 64, 67, 0.1);
    --kb-menu-dropdown-bg: var(--mieweb-card, #ffffff);
    --kb-menu-dropdown-border: var(--mieweb-border, #dadce0);
    --kb-menu-dropdown-text: var(--mieweb-card-foreground, #3c4043);
    --kb-menu-dropdown-hover: rgba(60, 64, 67, 0.08);
  }

  [data-theme='dark'],
  [data-theme='dark'] .kb-component,
  .dark,
  .dark .kb-component {
    --kb-color-primary: var(--mieweb-primary-500, #27aae1);
    --kb-color-text: var(--mieweb-foreground, #fafafa);
    --kb-color-text-muted: var(--mieweb-muted-foreground, #a1a1aa);
    --kb-color-icon: var(--mieweb-muted-foreground, #a1a1aa);
    --kb-color-surface: var(--mieweb-background, #171717);
    --kb-color-surface-elevated: var(--mieweb-muted, #404040);
    --kb-color-surface-hover: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 8%, transparent);
    --kb-color-border: var(--mieweb-border, #404040);
    --kb-color-border-strong: var(--mieweb-border, #404040);
    --kb-color-hover: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 8%, transparent);
    --kb-color-active: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 14%, transparent);
    --kb-menu-dropdown-bg: var(--mieweb-card, #262626);
    --kb-menu-dropdown-border: var(--mieweb-border, #404040);
    --kb-menu-dropdown-text: var(--mieweb-card-foreground, #fafafa);
    --kb-menu-dropdown-hover: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 8%, transparent);
  }

  [data-theme='light'] .kb-custom-menu,
  [data-theme='dark'] .kb-custom-menu,
  .dark .kb-custom-menu {
    background: var(--kb-color-surface-elevated);
    border-bottom-color: var(--kb-color-border-strong);
    color: var(--kb-color-text);
  }

  [data-theme='light'] .kb-custom-menu .kb-menu__button,
  [data-theme='light'] .kb-custom-menu .kb-dropdown__label,
  [data-theme='dark'] .kb-custom-menu .kb-menu__button,
  [data-theme='dark'] .kb-custom-menu .kb-dropdown__label,
  .dark .kb-custom-menu .kb-menu__button,
  .dark .kb-custom-menu .kb-dropdown__label {
    color: var(--kb-color-icon);
  }

  [data-theme='light'] .kb-dropdown__menu,
  [data-theme='light'] .kb-submenu__content,
  [data-theme='light'] .kb-custom-menu__overflow-menu,
  [data-theme='dark'] .kb-dropdown__menu,
  [data-theme='dark'] .kb-submenu__content,
  [data-theme='dark'] .kb-custom-menu__overflow-menu,
  .dark .kb-dropdown__menu,
  .dark .kb-submenu__content,
  .dark .kb-custom-menu__overflow-menu {
    background: var(--kb-menu-dropdown-bg) !important;
    border-color: var(--kb-menu-dropdown-border) !important;
    color: var(--kb-menu-dropdown-text) !important;
  }

  [data-theme='light'] .kb-custom-menu .kb-dropdown__item .kb-menu__button:hover,
  [data-theme='light'] .kb-custom-menu .kb-submenu__label:hover,
  [data-theme='light'] .kb-custom-menu__overflow-item:hover,
  [data-theme='dark'] .kb-custom-menu .kb-dropdown__item .kb-menu__button:hover,
  [data-theme='dark'] .kb-custom-menu .kb-submenu__label:hover,
  [data-theme='dark'] .kb-custom-menu__overflow-item:hover,
  .dark .kb-custom-menu .kb-dropdown__item .kb-menu__button:hover,
  .dark .kb-custom-menu .kb-submenu__label:hover,
  .dark .kb-custom-menu__overflow-item:hover {
    background: var(--kb-menu-dropdown-hover) !important;
    color: var(--kb-menu-dropdown-text) !important;
  }

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

  /* Keep overflow-menu icons inside their compact button hit areas. */
  .document-list-compose-editor .kb-custom-menu__overflow-menu .kb-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-width: 0 !important;
    min-height: 0 !important;
    line-height: 1;
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

export interface DocumentListWorkflowModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly runtime: DocumentListRuntimeState;
  readonly inputPrefix: string;
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

interface DocumentListComposeEditorProps {
  readonly ariaLabel: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly labelledBy: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}

interface DocumentListComposeEditorHandle {
  readonly getContent: () => Promise<string>;
}

const DocumentListComposeEditor = forwardRef<
  DocumentListComposeEditorHandle,
  DocumentListComposeEditorProps
>(function DocumentListComposeEditor(
  { ariaLabel, disabled, id, labelledBy, onChange, value },
  ref
): React.JSX.Element {
  const isDark = useIsDark();
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CoreEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const readyPromiseRef = useRef<Promise<void> | null>(null);
  const isLoadingRef = useRef(false);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (value === valueRef.current) return;
    valueRef.current = value;
    if (!editor) return;

    isLoadingRef.current = true;
    void editor
      .loadDocument(COMPOSE_CONTENT_TYPE, new TextEncoder().encode(value))
      .catch(() => undefined)
      .finally(() => {
        if (editorRef.current === editor) isLoadingRef.current = false;
      });
  }, [value]);

  useEffect(() => {
    disabledRef.current = disabled;
    editorRef.current?.view.setProps({
      editable: () => !disabledRef.current,
    });
  }, [disabled]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const mount = document.createElement('div');
    host.appendChild(mount);
    const editor = CoreEditor.create({
      element: mount,
      uri: 'file:///document.md',
      assetLoad: composeAssetLoad,
      editorKits: [new AdvancedEditorKit()],
      readOnly: disabledRef.current,
    });
    editorRef.current = editor;
    editor.view.setProps({
      editable: () => !disabledRef.current,
      attributes: { 'aria-label': ariaLabel },
    });

    let destroyed = false;
    let listening = false;
    const handleChanged = (): void => {
      if (isLoadingRef.current) return;
      void editor
        .saveDocument(COMPOSE_CONTENT_TYPE)
        .then((content) => {
          if (destroyed) return;
          const nextValue = new TextDecoder().decode(content);
          valueRef.current = nextValue;
          onChangeRef.current(nextValue);
        })
        .catch(() => undefined);
    };

    const loadInitialContent = async (): Promise<void> => {
      if (valueRef.current) {
        isLoadingRef.current = true;
        try {
          await editor.loadDocument(
            COMPOSE_CONTENT_TYPE,
            new TextEncoder().encode(valueRef.current)
          );
        } catch {
          // Keep the empty editor available when initial content cannot load.
        } finally {
          isLoadingRef.current = false;
        }
      }
      if (destroyed) return;
      editor.addEventListener('changed', handleChanged);
      listening = true;
    };

    readyPromiseRef.current = loadInitialContent();

    return () => {
      destroyed = true;
      if (listening) editor.removeEventListener('changed', handleChanged);
      editor.destroy();
      editorRef.current = null;
      readyPromiseRef.current = null;
      host.replaceChildren();
    };
    // The editor is intentionally created once for the modal instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getContent: async (): Promise<string> => {
        await readyPromiseRef.current;
        const editor = editorRef.current;
        if (!editor) return valueRef.current;
        const content = await editor.saveDocument(COMPOSE_CONTENT_TYPE);
        const nextValue = new TextDecoder().decode(content);
        valueRef.current = nextValue;
        return nextValue;
      },
    }),
    []
  );

  return (
    <div
      ref={hostRef}
      id={id}
      className={`kb-component document-list-compose-editor${
        isDark ? ' kb-component--dark' : ''
      }`}
      aria-labelledby={labelledBy}
      aria-label="Document note editor"
      aria-disabled={disabled || undefined}
      style={{
        isolation: 'isolate',
        opacity: disabled ? 0.65 : undefined,
        pointerEvents: disabled ? 'none' : undefined,
      }}
    />
  );
});

export function DocumentListComposeModal({
  open,
  onOpenChange,
  runtime,
  inputPrefix,
}: DocumentListWorkflowModalProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [docType, setDocType] = useState('Note');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<DocumentListComposeEditorHandle>(null);

  const reset = (): void => {
    setTitle('');
    setSubject('');
    setDocType('Note');
    setNote('');
    resetFormState(setError, setSaving);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && !saving) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedSubject = subject.trim();
    const trimmedDocType = docType.trim();
    if (!trimmedTitle || !trimmedSubject || !trimmedDocType) {
      setError('Title, subject, and document type are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const composedNote = editorRef.current
        ? await editorRef.current.getContent()
        : note;
      const id = createDocumentId();
      const content: DocumentListContentInput = {
        content: composedNote,
        contentType: COMPOSE_CONTENT_TYPE,
        size: contentSize(composedNote),
      };
      const document: DocumentListDocument = {
        id,
        date: today(),
        title: trimmedTitle,
        subject: trimmedSubject,
        docType: trimmedDocType,
        docId: id,
        source: 'Compose',
        file: `${id}.md`,
      };
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

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      aria-label="Compose document"
    >
      <ModalHeader>
        <ModalTitle>Compose document</ModalTitle>
        <ModalClose />
      </ModalHeader>
      <form onSubmit={handleSubmit} noValidate>
        <ModalBody className="document-list-workflow__body">
          <Input
            id={inputId(inputPrefix, 'compose-title')}
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={saving}
            required
          />
          <Input
            id={inputId(inputPrefix, 'compose-subject')}
            label="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={saving}
            required
          />
          <Input
            id={inputId(inputPrefix, 'compose-type')}
            label="Document type"
            value={docType}
            onChange={(event) => setDocType(event.target.value)}
            disabled={saving}
            required
          />
          <div className="document-list-workflow__field">
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
              value={note}
              onChange={setNote}
              disabled={saving}
            />
          </div>
          {error && (
            <p className="document-list-workflow__error" role="alert">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
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
            {saving ? 'Saving…' : 'Save document'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export function DocumentListUploadModal({
  open,
  onOpenChange,
  runtime,
  inputPrefix,
}: DocumentListWorkflowModalProps): React.JSX.Element {
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

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      aria-label="Upload document"
    >
      <ModalHeader>
        <ModalTitle>Upload document</ModalTitle>
        <ModalClose />
      </ModalHeader>
      <form onSubmit={handleSubmit} noValidate>
        <ModalBody className="document-list-workflow__body">
          <Input
            id={inputId(inputPrefix, 'upload-file')}
            label="Choose a file"
            type="file"
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
        </ModalBody>
        <ModalFooter>
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
            {saving ? 'Saving…' : 'Save document'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export interface DocumentListDetailRowProps {
  readonly document: DocumentListDocument;
  readonly runtime: DocumentListRuntimeState;
}

function formatSize(size: number | undefined): string {
  return size == null ? 'Unknown' : `${size} bytes`;
}

function ContentMetadata({
  document,
  content,
}: {
  readonly document: DocumentListDocument;
  readonly content?: DocumentListContent;
}): React.JSX.Element {
  return (
    <dl className="document-list-detail__content-meta">
      <div>
        <dt>Content</dt>
        <dd>
          {content?.text != null
            ? 'Text content'
            : 'Unavailable or unsupported'}
        </dd>
      </div>
      <div>
        <dt>Reference</dt>
        <dd>{content?.reference ?? document.file}</dd>
      </div>
      <div>
        <dt>Type</dt>
        <dd>{content?.contentType ?? document.docType}</dd>
      </div>
      <div>
        <dt>Size</dt>
        <dd>{formatSize(content?.size)}</dd>
      </div>
    </dl>
  );
}

export function DocumentListDetailRow({
  document,
  runtime,
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

  return (
    <div className="document-list-detail">
      <strong className="document-list-detail__title">{document.title}</strong>
      <dl className="document-list-detail__metadata">
        <div>
          <dt>Date</dt>
          <dd>{document.date}</dd>
        </div>
        <div>
          <dt>Subject</dt>
          <dd>{document.subject}</dd>
        </div>
        <div>
          <dt>Document type</dt>
          <dd>{document.docType}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{document.source}</dd>
        </div>
      </dl>
      {loading && <p role="status">Loading document content…</p>}
      {error && (
        <p className="document-list-workflow__error" role="alert">
          Could not load document content: {error}
        </p>
      )}
      {!loading && content?.text != null && (
        <div className="document-list-detail__text">{content.text}</div>
      )}
      {!loading && isImage && (
        <img
          className="document-list-detail__image"
          src={content?.reference}
          alt={document.title}
        />
      )}
      {!loading && content?.text == null && !isImage && (
        <ContentMetadata document={document} content={content} />
      )}
    </div>
  );
}
