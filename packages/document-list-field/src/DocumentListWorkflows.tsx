import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Textarea,
} from '@mieweb/ui';
import type {
  DocumentListContent,
  DocumentListContentInput,
  DocumentListRuntimeState,
} from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

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

    const id = createDocumentId();
    const content: DocumentListContentInput = {
      content: note,
      contentType: 'text/plain',
      size: contentSize(note),
    };
    const document: DocumentListDocument = {
      id,
      date: today(),
      title: trimmedTitle,
      subject: trimmedSubject,
      docType: trimmedDocType,
      docId: id,
      source: 'Compose',
      file: `${id}.txt`,
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
          <Textarea
            id={inputId(inputPrefix, 'compose-note')}
            label="Note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={saving}
            rows={7}
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
