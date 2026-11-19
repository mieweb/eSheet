import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DocumentListPdfPreview,
  DocumentListPdfViewer,
  documentPdfBlob,
} from './DocumentListPdfPreview.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

const pageRendering = vi.hoisted(() => ({
  paused: false,
  finish: undefined as (() => void) | undefined,
}));

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({
    children,
    file,
    onLoadSuccess,
    onLoadError,
  }: {
    readonly children: ReactNode;
    readonly file: string;
    readonly onLoadSuccess: (result: { numPages: number }) => void;
    readonly onLoadError: (error: Error) => void;
  }) => {
    const [loaded, setLoaded] = useState(false);
    const onLoadSuccessRef = useRef(onLoadSuccess);
    const onLoadErrorRef = useRef(onLoadError);
    useEffect(() => {
      if (file === 'blob:broken-pdf') {
        onLoadErrorRef.current(new Error('Invalid PDF structure.'));
        return;
      }
      onLoadSuccessRef.current({
        numPages:
          file === 'blob:single-page' ? 1 : file === 'blob:long-pdf' ? 40 : 2,
      });
      setLoaded(true);
    }, [file]);
    return createElement(
      'div',
      { 'data-testid': 'pdf-document' },
      loaded ? children : null
    );
  },
  Page: ({
    pageNumber,
    width,
    height,
    onLoadSuccess,
    onRenderSuccess,
    renderTextLayer,
  }: {
    readonly pageNumber: number;
    readonly width: number;
    readonly height?: number;
    readonly onLoadSuccess?: (page: {
      getViewport: () => { width: number; height: number };
    }) => void;
    readonly onRenderSuccess?: () => void;
    readonly renderTextLayer?: boolean;
  }) => {
    const onRenderSuccessRef = useRef(onRenderSuccess);
    const onLoadSuccessRef = useRef(onLoadSuccess);
    useEffect(() => {
      onLoadSuccessRef.current?.({
        getViewport: () => ({ width: 800, height: 400 }),
      });
      if (onRenderSuccessRef.current) {
        pageRendering.finish = () => onRenderSuccessRef.current?.();
      }
      if (!pageRendering.paused) onRenderSuccessRef.current?.();
    }, []);
    return createElement(
      'div',
      {
        'data-testid': 'pdf-page',
        'data-render-text-layer': String(renderTextLayer),
        'data-width': width,
        'data-height': height ?? 'auto',
      },
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

it('keeps the unfinished PDF out of loading layout until the page renders', async () => {
  pageRendering.paused = true;
  try {
    const { container } = render(
      createElement(DocumentListPdfViewer, {
        reference: 'blob:single-page',
        title: 'Loading preview',
      })
    );
    await screen.findByTestId('pdf-page');
    expect(
      container.querySelector('.document-list-pdf-preview__surface--loading')
    ).toBeTruthy();
    expect(screen.getByText('Rendering PDF…')).toBeTruthy();
    await act(async () => pageRendering.finish?.());
    expect(
      container.querySelector('.document-list-pdf-preview__surface--loading')
    ).toBeNull();
    expect(screen.queryByText('Rendering PDF…')).toBeNull();
  } finally {
    pageRendering.paused = false;
  }
});

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

function stubResizeObserver(): ReturnType<typeof vi.fn> {
  const observeMock = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element): void {
        observeMock(element, this.callback, this);
      }
      disconnect(): void {}
    }
  );
  return observeMock;
}

function observedPdfPage(observe: ReturnType<typeof vi.fn>): boolean {
  return observe.mock.calls.some(
    ([element]) =>
      element instanceof HTMLElement &&
      element.classList.contains('document-list-pdf-preview__pages')
  );
}

describe('DocumentListPdfViewer', () => {
  it('renders at the available width when its container shrinks or grows', async () => {
    const observe = stubResizeObserver();
    render(
      createElement(DocumentListPdfViewer, {
        reference: 'blob:single-page',
        title: 'Uploaded PDF',
      })
    );
    await screen.findByTestId('pdf-page');
    const observation = observe.mock.calls.find(
      ([element]) =>
        element instanceof HTMLElement &&
        element.classList.contains('document-list-pdf-preview__pages')
    );
    if (!observation)
      throw new Error('PDF page was not observed for resizing.');
    const [target, callback, observer] = observation;

    for (const width of [320, 1240, 640]) {
      await act(async () => {
        callback(
          [
            {
              target,
              contentRect: new DOMRectReadOnly(0, 0, width, 0),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: [],
            },
          ],
          observer
        );
      });
      expect(screen.getByTestId('pdf-page').dataset.width).toBe(String(width));
      expect(screen.getByTestId('pdf-page').dataset.height).toBe('auto');
    }
  });

  it('renders all PDF.js pages in order in one keyboard-focusable region', async () => {
    const onReady = vi.fn();
    const view = render(
      createElement(DocumentListPdfViewer, {
        reference: 'blob:uploaded-pdf',
        title: 'Uploaded PDF',
        onReady,
      })
    );

    const pages = await screen.findAllByTestId('pdf-page');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.container.querySelector('iframe, embed, object')).toBeNull();
    expect(onReady).toHaveBeenCalledOnce();
    const surface = screen.getByRole('region', {
      name: 'PDF preview of Uploaded PDF',
    });
    expect(surface.tabIndex).toBe(0);
    expect(pages.map((page) => page.textContent)).toEqual(['Page 1', 'Page 2']);
    expect(
      pages.every(
        (page) =>
          surface.contains(page) && page.dataset.renderTextLayer === 'true'
      )
    ).toBe(true);
    expect(
      screen.queryByRole('button', { name: /previous|next pdf page/i })
    ).toBeNull();
  });

  it('does not show page controls for a single-page PDF', async () => {
    render(
      createElement(DocumentListPdfViewer, {
        reference: 'blob:single-page',
        title: 'Single page',
      })
    );
    expect((await screen.findByTestId('pdf-page')).textContent).toBe('Page 1');
    expect(screen.queryByRole('navigation', { name: 'PDF pages' })).toBeNull();
  });

  it('mounts pages near the scroll viewport and releases those that leave it', async () => {
    type Visibility = Pick<
      IntersectionObserverEntry,
      'target' | 'isIntersecting'
    >;
    const observe = vi.fn<(target: Element) => void>();
    const disconnect = vi.fn();
    const createObserver =
      vi.fn<
        (
          callback: (entries: Visibility[]) => void,
          options: IntersectionObserverInit
        ) => void
      >();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: Visibility[]) => void,
          options: IntersectionObserverInit
        ) {
          createObserver(callback, options);
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    const view = render(
      createElement(DocumentListPdfViewer, {
        reference: 'blob:long-pdf',
        title: 'Long PDF',
      })
    );
    await screen.findByText('Page 1');
    expect(screen.getAllByTestId('pdf-page')).toHaveLength(1);
    expect(observe).toHaveBeenCalledTimes(40);
    const [notify, options] = createObserver.mock.calls[0];
    expect(options.root).toBe(screen.getByRole('region'));
    const first = observe.mock.calls[0][0] as HTMLElement;
    const last = observe.mock.calls[39][0];
    const firstRatio = first.style.aspectRatio;
    expect(firstRatio).toBe('2 / 1');
    await act(async () => {
      notify([
        { target: first, isIntersecting: false },
        { target: last, isIntersecting: true },
      ]);
    });
    expect(
      screen.getAllByTestId('pdf-page').map((page) => page.textContent)
    ).toEqual(['Page 40']);
    expect(first.isConnected).toBe(true);
    expect(first.style.aspectRatio).toBe(firstRatio);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('reports PDF.js loading errors explicitly', async () => {
    render(
      createElement(DocumentListPdfViewer, {
        reference: 'blob:broken-pdf',
        title: 'Broken PDF',
      })
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Invalid PDF structure.'
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('documentPdfBlob', () => {
  it('renders Markdown as a PDF', async () => {
    const runtime = runtimeWith({
      text: '# Return to work\n\nThe employee **may return** Monday.',
      contentType: 'text/x-markdown',
    });
    const blob = await documentPdfBlob({ ...document, rev: 3 }, runtime);

    expect(runtime.loadContent).toHaveBeenCalledWith(document.id, 3);
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
    const observeResize = stubResizeObserver();
    const nativePrint = vi.fn();
    const addEventListener = vi.fn(
      (_event: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') listener(new Event('load'));
      }
    );
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue({ addEventListener, print: nativePrint } as never);

    const runtime = runtimeWith({
      reference: 'blob:existing-pdf',
      contentType: 'application/pdf',
    });
    const view = render(
      createElement(DocumentListPdfPreview, {
        document: { ...document, rev: 2 },
        runtime,
        onClose,
        onReady,
      })
    );

    expect(observedPdfPage(observeResize)).toBe(false);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: document.title })).toBeTruthy();
    expect(screen.getByText(/Export document/)).toBeTruthy();
    expect(screen.getByText(/Revision 2/)).toBeTruthy();
    await screen.findByLabelText(`PDF preview of ${document.title}`);
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(runtime.loadContent).toHaveBeenCalledWith(document.id, 2);
    expect(observedPdfPage(observeResize)).toBe(true);
    expect(screen.getByRole('button', { name: /^Download PDF/ })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /^Download Markdown/ })
    ).toBeNull();
    expect(globalThis.document.querySelector('iframe')).toBeNull();
    expect(globalThis.document.querySelector('embed')).toBeNull();
    expect(globalThis.document.querySelector('object')).toBeNull();
    expect(
      screen.getAllByTestId('pdf-page').map((page) => page.textContent)
    ).toEqual(['Page 1', 'Page 2']);

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

  it('does not reload for an equivalent runtime snapshot', async () => {
    const source = new Blob(['%PDF-existing'], { type: 'application/pdf' });
    const loadContent = vi.fn(async () => ({
      reference: 'blob:existing-pdf',
      contentType: 'application/pdf',
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => source }))
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview-pdf'),
      revokeObjectURL: vi.fn(),
    });
    stubResizeObserver();
    const runtime = (): DocumentListRuntimeState =>
      ({ loadContent } as unknown as DocumentListRuntimeState);
    const view = render(
      createElement(DocumentListPdfPreview, {
        document,
        runtime: runtime(),
        onClose: vi.fn(),
      })
    );

    await screen.findAllByTestId('pdf-page');
    expect(loadContent).toHaveBeenCalledOnce();
    expect(loadContent).toHaveBeenLastCalledWith(document.id, 0);
    view.rerender(
      createElement(DocumentListPdfPreview, {
        document: { ...document },
        runtime: runtime(),
        onClose: vi.fn(),
      })
    );
    await waitFor(() => expect(loadContent).toHaveBeenCalledOnce());

    view.rerender(
      createElement(DocumentListPdfPreview, {
        document: { ...document, id: 'letter-2' },
        runtime: runtime(),
        onClose: vi.fn(),
      })
    );
    await waitFor(() => expect(loadContent).toHaveBeenCalledTimes(2));
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
