import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { Button } from '@mieweb/ui';
import { Download, Printer } from 'lucide-react';
import type { DocumentProps } from '@react-pdf/renderer';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import { DOCUMENT_LIST_MDY_TYPE } from './data.js';
import { mdyBody } from './mdy.js';
import type { DocumentListDocument } from './types.js';
import { DocumentListWorkflowPanel } from './DocumentListWorkflows.js';

interface MarkdownNode {
  readonly type: string;
  readonly value?: string;
  readonly url?: string;
  readonly ordered?: boolean;
  readonly children?: readonly MarkdownNode[];
}

type PdfModule = typeof import('@react-pdf/renderer');

const PDF_TYPE = 'application/pdf';

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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const filename = filenameFor(document.title);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void documentPdfBlob(document, runtime)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        onReadyRef.current?.();
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

  const download = (): void => {
    if (!previewUrl) return;
    const link = window.document.createElement('a');
    link.href = previewUrl;
    link.download = filename;
    link.click();
  };

  return (
    <DocumentListWorkflowPanel
      title={`PDF preview — ${document.title}`}
      onClose={onClose}
      size="xl"
    >
      <div className="document-list-pdf-preview">
        {error ? (
          <p className="document-list-pdf-preview__error" role="alert">
            {error}
          </p>
        ) : previewUrl ? (
          <iframe
            ref={frameRef}
            className="document-list-pdf-preview__frame"
            src={previewUrl}
            title={`PDF preview of ${document.title}`}
          />
        ) : (
          <p role="status">Preparing PDF…</p>
        )}
        <div className="document-list-pdf-preview__actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!previewUrl}
            onClick={download}
          >
            <Download size={16} aria-hidden="true" />
            Download
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!previewUrl}
            onClick={() => frameRef.current?.contentWindow?.print()}
          >
            <Printer size={16} aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>
    </DocumentListWorkflowPanel>
  );
}
