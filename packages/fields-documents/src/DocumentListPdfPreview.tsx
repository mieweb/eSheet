import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import {
  Button,
  Modal,
  ModalBody,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@mieweb/ui';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
import type { DocumentProps } from '@react-pdf/renderer';
import type {
  DocumentListContent,
  DocumentListRuntimeState,
} from './document-list-runtime.js';
import { DOCUMENT_LIST_MDY_TYPE } from './data.js';
import { mdyBody } from './mdy.js';
import type { DocumentListDocument } from './types.js';

interface MarkdownNode {
  readonly type: string;
  readonly value?: string;
  readonly url?: string;
  readonly ordered?: boolean;
  readonly children?: readonly MarkdownNode[];
}

type PdfModule = typeof import('@react-pdf/renderer');

const PDF_TYPE = 'application/pdf';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function filenameFor(title: string): string {
  const filename = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '');
  return `${filename || 'document'}.pdf`;
}

function textOf(node: MarkdownNode): string {
  if (node.value != null) return node.value;
  return node.children?.map(textOf).join('') ?? '';
}

function inlineNodes(
  nodes: readonly MarkdownNode[],
  renderer: PdfModule,
  keyPrefix: string
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'strong') {
      return createElement(
        renderer.Text,
        { key, style: { fontFamily: 'Helvetica-Bold' } },
        inlineNodes(node.children ?? [], renderer, key)
      );
    }
    if (node.type === 'emphasis') {
      return createElement(
        renderer.Text,
        { key, style: { fontFamily: 'Helvetica-Oblique' } },
        inlineNodes(node.children ?? [], renderer, key)
      );
    }
    if (node.type === 'inlineCode') {
      return createElement(
        renderer.Text,
        { key, style: { fontFamily: 'Courier' } },
        node.value ?? ''
      );
    }
    if (node.type === 'link') {
      return createElement(
        renderer.Link,
        { key, src: node.url ?? '' },
        inlineNodes(node.children ?? [], renderer, key)
      );
    }
    return node.children
      ? createElement(
          renderer.Text,
          { key },
          inlineNodes(node.children, renderer, key)
        )
      : node.value ?? '';
  });
}

function blockNodes(
  nodes: readonly MarkdownNode[],
  renderer: PdfModule,
  keyPrefix = 'block'
): ReactNode[] {
  return nodes.flatMap((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'heading') {
      return createElement(
        renderer.Text,
        {
          key,
          style: {
            fontFamily: 'Helvetica-Bold',
            fontSize: 18,
            marginBottom: 10,
          },
        },
        inlineNodes(node.children ?? [], renderer, key)
      );
    }
    if (node.type === 'paragraph') {
      return createElement(
        renderer.Text,
        { key, style: { marginBottom: 8, lineHeight: 1.45 } },
        inlineNodes(node.children ?? [], renderer, key)
      );
    }
    if (node.type === 'list') {
      return (node.children ?? []).map((item, itemIndex) =>
        createElement(
          renderer.View,
          {
            key: `${key}-${itemIndex}`,
            style: { flexDirection: 'row', marginBottom: 4 },
          },
          createElement(
            renderer.Text,
            { style: { width: 22 } },
            node.ordered ? `${itemIndex + 1}.` : '•'
          ),
          createElement(
            renderer.View,
            { style: { flex: 1 } },
            blockNodes(item.children ?? [], renderer, `${key}-${itemIndex}`)
          )
        )
      );
    }
    if (node.type === 'blockquote') {
      return createElement(
        renderer.View,
        {
          key,
          style: {
            borderLeft: '2 solid #777',
            marginBottom: 8,
            paddingLeft: 10,
          },
        },
        blockNodes(node.children ?? [], renderer, key)
      );
    }
    if (node.type === 'code') {
      return createElement(
        renderer.Text,
        {
          key,
          style: {
            backgroundColor: '#f1f1f1',
            fontFamily: 'Courier',
            fontSize: 9,
            marginBottom: 8,
            padding: 8,
          },
        },
        node.value ?? ''
      );
    }
    if (node.type === 'thematicBreak') {
      return createElement(renderer.View, {
        key,
        style: { borderTop: '1 solid #aaa', marginBottom: 10 },
      });
    }
    if (node.type === 'table') {
      return createElement(
        renderer.View,
        { key, style: { marginBottom: 10 } },
        ...(node.children ?? []).map((row, rowIndex) =>
          createElement(
            renderer.View,
            {
              key: `${key}-${rowIndex}`,
              style: { flexDirection: 'row' },
            },
            ...(row.children ?? []).map((cell, cellIndex) =>
              createElement(
                renderer.Text,
                {
                  key: `${key}-${rowIndex}-${cellIndex}`,
                  style: {
                    border: '1 solid #aaa',
                    flex: 1,
                    fontFamily: rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica',
                    padding: 4,
                  },
                },
                textOf(cell)
              )
            )
          )
        )
      );
    }
    return node.children
      ? blockNodes(node.children, renderer, key)
      : node.value
      ? createElement(renderer.Text, { key }, node.value)
      : [];
  });
}

async function markdownPdf(markdown: string): Promise<Blob> {
  const renderer = await import('@react-pdf/renderer');
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MarkdownNode;
  const document = createElement(
    renderer.Document,
    null,
    createElement(
      renderer.Page,
      {
        size: 'LETTER',
        style: {
          color: '#111',
          fontFamily: 'Helvetica',
          fontSize: 11,
          paddingBottom: 54,
          paddingHorizontal: 54,
          paddingTop: 54,
        },
      },
      blockNodes(tree.children ?? [], renderer)
    )
  ) as ReactElement<DocumentProps>;
  return renderer.pdf(document).toBlob();
}

export async function documentPdfBlob(
  document: DocumentListDocument,
  runtime: DocumentListRuntimeState
): Promise<Blob> {
  const content = await runtime.loadContent(document.id);
  if (!content) throw new Error('Document content is unavailable.');
  return pdfBlobForContent(content);
}

async function pdfBlobForContent(content: DocumentListContent): Promise<Blob> {
  if (content.contentType === PDF_TYPE && content.reference) {
    const response = await fetch(content.reference);
    if (!response.ok) throw new Error('The PDF could not be loaded.');
    return response.blob();
  }
  if (content.text != null) {
    const markdown =
      content.contentType === DOCUMENT_LIST_MDY_TYPE
        ? mdyBody(content.text)
        : content.text;
    return markdownPdf(markdown);
  }
  throw new Error(
    `PDF preview does not support ${content.contentType || 'this file type'}.`
  );
}

export function DocumentListPdfPreview({
  document,
  runtime,
  onClose,
  onReady,
}: {
  readonly document: DocumentListDocument;
  readonly runtime: DocumentListRuntimeState;
  readonly onClose: () => void;
  readonly onReady?: () => void;
}): React.JSX.Element {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const descriptionId = useId();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [ready, setReady] = useState(false);
  const pdfFilename = filenameFor(document.title);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void runtime
      .loadContent(document.id)
      .then(async (content) => {
        if (!content) throw new Error('Document content is unavailable.');
        const blob = await pdfBlobForContent(content);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document, runtime]);

  useEffect(() => {
    if (!previewUrl || ready || error) return;
    const timeout = window.setTimeout(
      () => setError('The PDF preview could not be rendered.'),
      15_000
    );
    return () => window.clearTimeout(timeout);
  }, [error, previewUrl, ready]);

  const downloadPdf = (): void => {
    if (!previewUrl) return;
    const link = window.document.createElement('a');
    link.href = previewUrl;
    link.download = pdfFilename;
    link.click();
  };

  const print = (): void => {
    if (!previewUrl) return;
    const printWindow = window.open(previewUrl, '_blank');
    if (!printWindow) {
      setError('The native print window was blocked by your browser.');
      return;
    }
    printWindow.addEventListener('load', () => printWindow.print(), {
      once: true,
    });
  };

  const handlePdfReady = ({
    numPages,
  }: {
    readonly numPages: number;
  }): void => {
    setPageCount(numPages);
    setPageNumber(1);
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="full"
      className="document-list-pdf-modal"
      aria-describedby={descriptionId}
    >
      <ModalHeader className="document-list-pdf-modal__header">
        <div className="document-list-pdf-modal__heading">
          <ModalTitle>{document.title}</ModalTitle>
          <p
            id={descriptionId}
            className="document-list-pdf-modal__description"
          >
            Export document
            {document.docType ? ` · ${document.docType}` : ''}
            {document.rev != null ? ` · Revision ${document.rev}` : ''}
          </p>
        </div>
        <ModalClose />
      </ModalHeader>
      <ModalBody className="document-list-pdf-modal__body">
        <div className="document-list-pdf-preview">
          {error ? (
            <div className="document-list-pdf-preview__message">
              <p className="document-list-pdf-preview__error" role="alert">
                {error}
              </p>
            </div>
          ) : previewUrl ? (
            <div
              className="document-list-pdf-preview__surface"
              aria-label={`PDF preview of ${document.title}`}
            >
              {!ready ? (
                <div
                  className="document-list-pdf-preview__message"
                  role="status"
                >
                  <span className="document-list-pdf-preview__spinner" />
                  Rendering PDF…
                </div>
              ) : null}
              <PdfDocument
                file={previewUrl}
                loading={null}
                error={null}
                onLoadSuccess={handlePdfReady}
                onLoadError={(cause) => setError(cause.message)}
              >
                <div className="document-list-pdf-preview__page">
                  <PdfPage
                    pageNumber={pageNumber}
                    width={816}
                    devicePixelRatio={1}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    loading={null}
                    onRenderSuccess={() => {
                      if (!ready) {
                        setReady(true);
                        onReadyRef.current?.();
                      }
                    }}
                    onRenderError={(cause) => setError(cause.message)}
                  />
                </div>
              </PdfDocument>
              {pageCount > 1 ? (
                <nav
                  className="document-list-pdf-preview__navigation"
                  aria-label="PDF pages"
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pageNumber === 1}
                    onClick={() => setPageNumber((current) => current - 1)}
                    aria-label="Previous PDF page"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </Button>
                  <span>
                    Page {pageNumber} of {pageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pageNumber === pageCount}
                    onClick={() => setPageNumber((current) => current + 1)}
                    aria-label="Next PDF page"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </nav>
              ) : null}
            </div>
          ) : (
            <div className="document-list-pdf-preview__message" role="status">
              <span className="document-list-pdf-preview__spinner" />
              Preparing PDF…
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="document-list-pdf-modal__footer">
        <span className="document-list-pdf-modal__filename">{pdfFilename}</span>
        <div className="document-list-pdf-modal__actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!previewUrl}
            onClick={downloadPdf}
            aria-label={`Download PDF ${pdfFilename}`}
          >
            <Download size={16} aria-hidden="true" />
            Download PDF
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!previewUrl}
            onClick={print}
            aria-label={`Print ${document.title}`}
          >
            <Printer size={16} aria-hidden="true" />
            Print PDF
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
