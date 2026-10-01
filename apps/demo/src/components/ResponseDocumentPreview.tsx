import { useEffect, useId, useRef, useState } from 'react';
import type { FormDefinition, FormResponse } from '@esheet/core';
import { exportResponse } from '@esheet/adapters';
import { renderResponseHtml } from '@esheet/adapters/html';
import './ResponseDocumentPreview.css';

export const responseDocumentLabels = {
  open: 'Preview document',
  title: 'Response document',
  close: 'Close preview',
  frameTitle: 'Printable response document',
  busy: 'Generating document…',
  ready: 'Document ready.',
  error: 'Unable to generate the document. Check the form and output template.',
  snapshotError: 'Unable to snapshot the current form for export.',
  downloadError: 'Unable to download the document.',
  printError:
    'Unable to print the document. Download the HTML and print it from your browser.',
  preservationWarning:
    'MDY includes the complete form and all stored answers, including hidden answers and attachment references. It is not a redacted export. Review before sharing.',
  completionNotice:
    'Incomplete responses can be exported; completion validation is not enforced.',
  downloadMdy: 'Download MDY (full data)',
  downloadMarkdown: 'Download Markdown (body only)',
  downloadHtml: 'Download HTML',
  print: 'Print document',
  previewMdy: 'Preview MDY (full data)',
  previewMarkdown: 'Preview Markdown (body only)',
  diagnostics: 'Export diagnostics',
  diagnostic: (code: string, fieldId?: string) =>
    fieldId ? `${code} — ${fieldId}` : code,
};

export interface ResponseDocumentSnapshot {
  readonly form: FormDefinition;
  readonly response: FormResponse;
}

export interface ResponseDocumentPreviewProps {
  /** A detached snapshot; replace it to generate a different document. */
  readonly snapshot: ResponseDocumentSnapshot | null;
  readonly onClose: () => void;
  readonly labels?: Partial<typeof responseDocumentLabels>;
}

interface GeneratedDocument {
  readonly snapshot: ResponseDocumentSnapshot;
  readonly mdy: string;
  readonly markdown: string;
  readonly html: string;
  readonly diagnostics: ReadonlyArray<{ code: string; fieldId?: string }>;
}

export function ResponseDocumentPreview({
  snapshot,
  ...props
}: ResponseDocumentPreviewProps) {
  return snapshot ? <DocumentDialog snapshot={snapshot} {...props} /> : null;
}

function DocumentDialog({
  snapshot,
  onClose,
  labels: overrides,
}: ResponseDocumentPreviewProps & { snapshot: ResponseDocumentSnapshot }) {
  const labels = { ...responseDocumentLabels, ...overrides };
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [failedSnapshot, setFailedSnapshot] =
    useState<ResponseDocumentSnapshot | null>(null);
  const [loadedDocument, setLoadedDocument] =
    useState<GeneratedDocument | null>(null);
  const [actionError, setActionError] = useState<
    'downloadError' | 'printError' | null
  >(null);
  const result = generated?.snapshot === snapshot ? generated : null;
  const failed = failedSnapshot === snapshot;
  const busy = !result && !failed;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const urls = downloads.current;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      dialog?.close();
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setActionError(null);
    const generate = async () => {
      try {
        const exported = await exportResponse(snapshot.form, snapshot.response);
        if (cancelled) return;
        const root = document.documentElement;
        const html = await renderResponseHtml(exported.markdown, {
          title: snapshot.form.title,
          language: root.lang || navigator.language,
          direction:
            getComputedStyle(root).direction === 'rtl' || root.dir === 'rtl'
              ? 'rtl'
              : 'ltr',
        });
        if (!cancelled) setGenerated({ ...exported, html, snapshot });
      } catch {
        if (!cancelled) setFailedSnapshot(snapshot);
      }
    };
    void generate();
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  const download = (content: string, extension: string, mime: string) => {
    setActionError(null);
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      // Give the browser time to consume the URL, but also revoke on close.
      downloads.current.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url);
          downloads.current.delete(url);
        }, 1000)
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      const basename =
        snapshot.form.id.replace(/[^a-z0-9_-]/gi, '_') || 'response';
      anchor.download = `${basename}.${extension}`;
      document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
      }
    } catch {
      setActionError('downloadError');
    }
  };

  const print = () => {
    setActionError(null);
    try {
      const frame = frameRef.current?.contentWindow;
      if (!frame || !result || loadedDocument !== result) return;
      frame.focus();
      frame.print();
    } catch {
      setActionError('printError');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="response-document-preview"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-preservation ${id}-completion`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="response-document-preview__header">
        <h2 id={`${id}-title`}>{labels.title}</h2>
        <button ref={closeRef} type="button" onClick={onClose}>
          {labels.close}
        </button>
      </header>
      <p
        id={`${id}-preservation`}
        className="response-document-preview__warning"
      >
        {labels.preservationWarning}
      </p>
      <p id={`${id}-completion`}>{labels.completionNotice}</p>
      <p role="status" aria-live="polite" aria-atomic="true">
        {busy ? labels.busy : result ? labels.ready : ''}
      </p>
      <p role="alert" aria-live="assertive" aria-atomic="true">
        {failed ? labels.error : actionError ? labels[actionError] : ''}
      </p>
      <section
        className="response-document-preview__document"
        aria-busy={busy}
        aria-label={labels.title}
      >
        {result && (
          <>
            <nav
              className="response-document-preview__actions"
              aria-label={labels.title}
            >
              <button
                type="button"
                onClick={() =>
                  download(result.mdy, 'mdy', 'text/plain;charset=utf-8')
                }
              >
                {labels.downloadMdy}
              </button>
              <button
                type="button"
                onClick={() =>
                  download(result.markdown, 'md', 'text/markdown;charset=utf-8')
                }
              >
                {labels.downloadMarkdown}
              </button>
              <button
                type="button"
                onClick={() =>
                  download(result.html, 'html', 'text/html;charset=utf-8')
                }
              >
                {labels.downloadHtml}
              </button>
              <button
                type="button"
                onClick={print}
                disabled={loadedDocument !== result}
              >
                {labels.print}
              </button>
            </nav>
            {result.diagnostics.length > 0 && (
              <section
                className="response-document-preview__diagnostics"
                aria-label={labels.diagnostics}
                role="status"
                aria-live="polite"
              >
                <h3>{labels.diagnostics}</h3>
                <ul>
                  {result.diagnostics.map((diagnostic, index) => (
                    <li key={index}>
                      {labels.diagnostic(diagnostic.code, diagnostic.fieldId)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <iframe
              key={result.html}
              ref={frameRef}
              className="response-document-preview__frame"
              title={labels.frameTitle}
              sandbox="allow-same-origin allow-modals"
              srcDoc={result.html}
              onLoad={() => setLoadedDocument(result)}
            />
            <details className="response-document-preview__source">
              <summary>{labels.previewMarkdown}</summary>
              <pre>{result.markdown}</pre>
            </details>
            <details className="response-document-preview__source">
              <summary>{labels.previewMdy}</summary>
              <pre>{result.mdy}</pre>
            </details>
          </>
        )}
      </section>
    </dialog>
  );
}
