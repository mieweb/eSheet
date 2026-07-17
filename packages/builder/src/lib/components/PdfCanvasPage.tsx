import React from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { PdfFieldMapping } from '@esheet/pdf';

interface IndexedMapping {
  index: number;
  mapping: PdfFieldMapping;
  preview: {
    value?: string;
    checked?: boolean;
  };
}

export interface PdfCanvasPageProps {
  document: PDFDocumentProxy;
  pageIndex: number;
  scale: number;
  mappings: IndexedMapping[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onChange: (index: number, mapping: PdfFieldMapping) => void;
  onActivatePage: (pageIndex: number) => void;
}

interface PageState {
  page: PDFPageProxy;
  viewport: PageViewport;
}

const ANNOTATION_MODE_DISABLED = 0;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function viewportRect(
  viewport: PageViewport,
  rect: PdfFieldMapping['rect']
): { left: number; top: number; width: number; height: number } {
  const [x, y, width, height] = rect;
  const first = viewport.convertToViewportPoint(x, y);
  const second = viewport.convertToViewportPoint(x + width, y + height);
  const left = Math.min(first[0], second[0]);
  const top = Math.min(first[1], second[1]);
  return {
    left,
    top,
    width: Math.abs(second[0] - first[0]),
    height: Math.abs(second[1] - first[1]),
  };
}

function OverlayPreview({
  mapping,
  preview,
}: {
  mapping: PdfFieldMapping;
  preview: IndexedMapping['preview'];
}) {
  switch (mapping.kind) {
    case 'checkbox':
      return (
        <span className="ms:flex ms:h-full ms:w-full ms:items-center ms:justify-center ms:text-[10px] ms:font-bold ms:text-msprimary">
          {preview.checked ? '✓' : ''}
        </span>
      );
    case 'radio':
      return (
        <span className="ms:flex ms:h-full ms:w-full ms:items-center ms:justify-center">
          {preview.checked && (
            <span className="ms:h-2 ms:w-2 ms:rounded-full ms:bg-msprimary" />
          )}
        </span>
      );
    case 'dropdown':
      return (
        <span className="ms:flex ms:w-full ms:items-center ms:justify-between ms:gap-1 ms:overflow-hidden ms:px-1.5 ms:text-[10px] ms:text-mstext">
          <span className="ms:truncate">{preview.value}</span>
          <span className="ms:text-msprimary">▾</span>
        </span>
      );
    default:
      return (
        <span className="ms:w-full ms:truncate ms:px-1.5 ms:text-[10px] ms:text-mstext">
          {preview.value}
        </span>
      );
  }
}

export const PdfCanvasPage = React.memo(function PdfCanvasPage({
  document,
  pageIndex,
  scale,
  mappings,
  selectedIndex,
  onSelect,
  onChange,
  onActivatePage,
}: PdfCanvasPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [pageState, setPageState] = React.useState<PageState | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;

    void document
      .getPage(pageIndex + 1)
      .then((page) => {
        if (disposed) return;
        const viewport = page.getViewport({ scale });
        setPageState({ page, viewport });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvas,
          viewport,
          transform:
            outputScale === 1
              ? undefined
              : [outputScale, 0, 0, outputScale, 0, 0],
          annotationMode: ANNOTATION_MODE_DISABLED,
        });
        return renderTask.promise;
      })
      .catch((reason: unknown) => {
        if (
          !disposed &&
          !(
            reason instanceof Error &&
            reason.name === 'RenderingCancelledException'
          )
        ) {
          console.error('Unable to render PDF canvas page.', reason);
        }
      });

    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [document, pageIndex, scale]);

  const beginInteraction = React.useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      indexed: IndexedMapping,
      interaction: 'move' | 'resize'
    ) => {
      if (!pageState) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(indexed.index);
      event.currentTarget.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const original = indexed.mapping;
      const originalViewportRect = viewportRect(
        pageState.viewport,
        original.rect
      );
      const [pageX1, pageY1, pageX2, pageY2] = pageState.viewport.viewBox;
      const pageWidth = Math.abs(pageX2 - pageX1);
      const pageHeight = Math.abs(pageY2 - pageY1);

      const handleMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        if (interaction === 'move') {
          const nextLeft = originalViewportRect.left + deltaX;
          const nextTop = originalViewportRect.top + deltaY;
          const [pdfX, pdfY] = pageState.viewport.convertToPdfPoint(
            nextLeft,
            nextTop + originalViewportRect.height
          );
          const width = original.rect[2];
          const height = original.rect[3];
          onChange(indexed.index, {
            ...original,
            rect: [
              clamp(pdfX, 0, pageWidth - width),
              clamp(pdfY, 0, pageHeight - height),
              width,
              height,
            ],
          });
        } else {
          const width = clamp(
            original.rect[2] + deltaX / scale,
            12,
            pageWidth - original.rect[0]
          );
          const originalTop = original.rect[1] + original.rect[3];
          const height = clamp(
            original.rect[3] + deltaY / scale,
            12,
            originalTop
          );
          const y = originalTop - height;
          onChange(indexed.index, {
            ...original,
            rect: [original.rect[0], y, width, height],
          });
        }
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp, { once: true });
    },
    [onChange, onSelect, pageState, scale]
  );

  const viewport = pageState?.viewport;

  return (
    <div className="ms:flex ms:flex-col ms:items-center ms:gap-2">
      <div
        className="ms:text-xs ms:font-medium ms:text-mstextmuted"
        aria-label={`PDF page ${pageIndex + 1}`}
      >
        Page {pageIndex + 1}
      </div>
      <div
        className="ms:relative ms:shrink-0 ms:bg-white ms:shadow-lg ms:ring-1 ms:ring-black/10"
        style={
          viewport
            ? { width: viewport.width, height: viewport.height }
            : { width: 612 * scale, height: 792 * scale }
        }
        onPointerDown={() => onActivatePage(pageIndex)}
      >
        <canvas ref={canvasRef} className="ms:block" />
        {viewport && (
          <div
            className="ms:absolute ms:inset-0"
            aria-label="AcroForm field layer"
          >
            {mappings.map((indexed) => {
              const box = viewportRect(viewport, indexed.mapping.rect);
              const selected = indexed.index === selectedIndex;
              return (
                <div
                  key={`${indexed.mapping.pdfFieldName}:${
                    indexed.mapping.optionId ?? indexed.index
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`PDF field ${indexed.mapping.esheetFieldId}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(indexed.index);
                  }}
                  className={`ms:absolute ms:flex ms:items-center ms:overflow-visible ms:border ms:bg-white/85 ms:text-xs ms:text-mstext ms:transition-colors ${
                    selected
                      ? 'ms:z-10 ms:border-msprimary ms:ring-2 ms:ring-msprimary/30'
                      : 'ms:border-msprimary/45 ms:hover:border-msprimary'
                  }`}
                  style={{
                    left: box.left,
                    top: box.top,
                    width: Math.max(box.width, 10),
                    height: Math.max(box.height, 10),
                  }}
                >
                  <OverlayPreview
                    mapping={indexed.mapping}
                    preview={indexed.preview}
                  />
                  {selected && (
                    <>
                      <button
                        type="button"
                        title="Move field"
                        aria-label="Move PDF field"
                        onPointerDown={(event) =>
                          beginInteraction(event, indexed, 'move')
                        }
                        className="ms:absolute ms:-top-3 ms:-left-3 ms:flex ms:h-6 ms:w-6 ms:cursor-move ms:items-center ms:justify-center ms:rounded-full ms:border ms:border-msprimary ms:bg-msprimary ms:text-[11px] ms:text-white ms:shadow"
                      >
                        ✥
                      </button>
                      <button
                        type="button"
                        title="Resize field"
                        aria-label="Resize PDF field"
                        onPointerDown={(event) =>
                          beginInteraction(event, indexed, 'resize')
                        }
                        className="ms:absolute ms:-right-2 ms:-bottom-2 ms:h-4 ms:w-4 ms:cursor-nwse-resize ms:rounded-sm ms:border ms:border-white ms:bg-msprimary ms:shadow"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
