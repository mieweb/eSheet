import React from 'react';
import type {
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist';

export interface PdfPageThumbnailProps {
  document: PDFDocumentProxy;
  pageIndex: number;
  active: boolean;
  onSelect: (pageIndex: number) => void;
}

const THUMBNAIL_WIDTH = 112;
const ANNOTATION_MODE_DISABLED = 0;

export function PdfPageThumbnail({
  document,
  pageIndex,
  active,
  onSelect,
}: PdfPageThumbnailProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;

    void document.getPage(pageIndex + 1).then((loadedPage) => {
      if (cancelled) return;
      const baseViewport = loadedPage.getViewport({ scale: 1 });
      const viewport = loadedPage.getViewport({
        scale: THUMBNAIL_WIDTH / baseViewport.width,
      });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = loadedPage.render({
        canvas,
        canvasContext: context,
        viewport,
        annotationMode: ANNOTATION_MODE_DISABLED,
        transform:
          pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      void renderTask.promise.catch((reason: unknown) => {
        if (
          !cancelled &&
          !(reason instanceof Error && reason.name === 'RenderingCancelledException')
        ) {
          console.error('Unable to render PDF page thumbnail.', reason);
        }
      });
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageIndex]);

  return (
    <button
      type="button"
      aria-label={`Go to PDF page ${pageIndex + 1}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(pageIndex)}
      className={`ms:flex ms:w-full ms:flex-col ms:items-center ms:gap-1.5 ms:rounded-lg ms:border ms:p-2 ms:transition-colors ${
        active
          ? 'ms:border-msprimary ms:bg-msprimary/10 ms:ring-1 ms:ring-msprimary/30'
          : 'ms:border-transparent ms:bg-transparent ms:hover:border-msborder ms:hover:bg-msbackground'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="ms:block ms:max-w-full ms:bg-white ms:shadow-sm ms:ring-1 ms:ring-black/10"
      />
      <span
        className={`ms:text-xs ms:font-medium ${
          active ? 'ms:text-msprimary' : 'ms:text-mstextmuted'
        }`}
      >
        Page {pageIndex + 1}
      </span>
    </button>
  );
}
