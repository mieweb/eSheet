import { createElement, useEffect, useRef, type ReactNode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DocumentListPdfPreview,
  documentPdfBlob,
} from './DocumentListPdfPreview.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({
    children,
    onLoadSuccess,
  }: {
    readonly children: ReactNode;
    readonly onLoadSuccess: (result: { numPages: number }) => void;
  }) => {
    const onLoadSuccessRef = useRef(onLoadSuccess);
    useEffect(() => onLoadSuccessRef.current({ numPages: 2 }), []);
    return createElement('div', { 'data-testid': 'pdf-document' }, children);
  },
  Page: ({
    pageNumber,
    onRenderSuccess,
  }: {
    readonly pageNumber: number;
    readonly onRenderSuccess: () => void;
  }) => {
    const onRenderSuccessRef = useRef(onRenderSuccess);
    useEffect(() => onRenderSuccessRef.current(), []);
    return createElement(
      'div',
      { 'data-testid': 'pdf-page' },
      `Page ${pageNumber}`
    );
  },
}));

const document: DocumentListDocument = {
  id: 'letter-1',
  date: '2026-10-02',
  title: 'Return / work letter',
  subject: 'Return to work',
  docType: 'return-to-work',
  docId: 'letter-1',
  source: 'Compose',
  file: 'letter-1.md',
};

function runtimeWith(content: {
  text?: string;
  reference?: string;
  contentType?: string;
}): DocumentListRuntimeState {
  return {
    loadContent: vi.fn(async () => content),
  } as unknown as DocumentListRuntimeState;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubResizeObserver(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    }
  );
}

describe('documentPdfBlob', () => {
  it('renders Markdown as a PDF', async () => {
    const blob = await documentPdfBlob(
      document,
      runtimeWith({
        text: '# Return to work\n\nThe employee **may return** Monday.',
        contentType: 'text/x-markdown',
      })
    );

    expect(blob.type).toBe('application/pdf');
    expect(
      new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))
    ).toBe('%PDF-');
  });

  it('strips MDY front matter before rendering', async () => {
    const blob = await documentPdfBlob(
      document,
      runtimeWith({
        text: '---\ndocType: return-to-work\n---\n# Cleared for duty',
        contentType: 'text/x-mdy',
      })
    );

    expect(blob.size).toBeGreaterThan(100);
  });

  it('passes through an existing PDF', async () => {
    const source = new Blob(['%PDF-existing'], { type: 'application/pdf' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => source,
      }))
    );

    const blob = await documentPdfBlob(
      document,
      runtimeWith({
        reference: 'blob:existing-pdf',
        contentType: 'application/pdf',
      })
    );

    expect(await blob.text()).toBe('%PDF-existing');
  });

  it('renders custom PDF pages and opens the native viewer only for print', async () => {
    const source = new Blob(['%PDF-existing'], { type: 'application/pdf' });
    const onClose = vi.fn();
    const onReady = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:preview-pdf');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => source,
      }))
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    stubResizeObserver();
    const nativePrint = vi.fn();
    const addEventListener = vi.fn(
      (_event: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') listener(new Event('load'));
      }
    );
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue({ addEventListener, print: nativePrint } as never);

    const view = render(
      createElement(DocumentListPdfPreview, {
        document: { ...document, rev: 2 },
        runtime: runtimeWith({
          reference: 'blob:existing-pdf',
          contentType: 'application/pdf',
        }),
        onClose,
        onReady,
      })
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: document.title })).toBeTruthy();
    expect(screen.getByText(/Export document/)).toBeTruthy();
    expect(screen.getByText(/Revision 2/)).toBeTruthy();
    await screen.findByLabelText(`PDF preview of ${document.title}`);
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: /^Download PDF/ })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /^Download Markdown/ })
    ).toBeNull();
    expect(globalThis.document.querySelector('iframe')).toBeNull();
    expect(globalThis.document.querySelector('embed')).toBeNull();
    expect(globalThis.document.querySelector('object')).toBeNull();
    expect(screen.getByTestId('pdf-page').textContent).toBe('Page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Next PDF page' }));
    expect(screen.getByTestId('pdf-page').textContent).toBe('Page 2');

    fireEvent.click(
      screen.getByRole('button', { name: `Print ${document.title}` })
    );
    expect(open).toHaveBeenCalledWith('blob:preview-pdf', '_blank');
    expect(nativePrint).toHaveBeenCalledOnce();

    const footerClose = screen.getByText('Close').closest('button');
    expect(footerClose).toBeTruthy();
    fireEvent.click(footerClose as HTMLButtonElement);
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-pdf');
  });

  it('offers only PDF download for MDY source', async () => {
    const createObjectURL = vi.fn(() => 'blob:preview-pdf');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    stubResizeObserver();

    render(
      createElement(DocumentListPdfPreview, {
        document,
        runtime: runtimeWith({
          text: '---\ndocType: return-to-work\n---\n# Cleared for duty',
          contentType: 'text/x-mdy',
        }),
        onClose: vi.fn(),
      })
    );

    expect(
      await screen.findByRole('button', { name: /^Download PDF/ })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Download Markdown/ })
    ).toBeNull();
  });
});
