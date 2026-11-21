import React from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { PdfFieldMapping } from '@esheet/pdf';
import type { FieldOption, FieldResponse } from '@esheet/core';

interface IndexedMapping {
  index: number;
  mapping: PdfFieldMapping;
  options?: FieldOption[];
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
  selectedRadioGroupName?: string;
  editable?: boolean;
  fillable?: boolean;
  onSelect: (index: number) => void;
  onChange: (index: number, mapping: PdfFieldMapping) => void;
  onResponseChange: (index: number, response: FieldResponse) => void;
  onActivatePage: (pageIndex: number) => void;
}

interface PageState {
  page: PDFPageProxy;
  viewport: PageViewport;
}

interface AlignmentGuides {
  horizontal?: number;
  vertical?: number;
}

const ANNOTATION_MODE_DISABLED = 0;
const SNAP_DISTANCE = 6;

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

function snapPosition(
  position: number,
  size: number,
  candidates: readonly number[]
): { guide?: number; value: number } {
  const anchors = [position, position + size / 2, position + size];
  let closest: { distance: number; value: number; guide: number } | undefined;

  for (const candidate of candidates) {
    for (const anchor of anchors) {
      const distance = Math.abs(candidate - anchor);
      if (distance > SNAP_DISTANCE && closest) continue;
      if (distance > SNAP_DISTANCE) continue;
      if (!closest || distance < closest.distance) {
        closest = {
          distance,
          value: position + candidate - anchor,
          guide: candidate,
        };
      }
    }
  }

  return closest ?? { value: position };
}

function alignmentCandidates(
  index: number,
  mappings: readonly IndexedMapping[],
  pageWidth: number,
  pageHeight: number
): { horizontal: number[]; vertical: number[] } {
  const horizontal = [0, pageHeight];
  const vertical = [0, pageWidth];

  for (const indexed of mappings) {
    if (indexed.index === index) continue;
    const [x, y, width, height] = indexed.mapping.rect;
    vertical.push(x, x + width / 2, x + width);
    horizontal.push(y, y + height / 2, y + height);
  }

  return { horizontal, vertical };
}

function OverlayPreview({
  mapping,
  options,
  preview,
  onResponseChange,
  fillable,
}: {
  mapping: PdfFieldMapping;
  options: FieldOption[] | undefined;
  preview: IndexedMapping['preview'];
  onResponseChange: (response: FieldResponse) => void;
  fillable: boolean;
}) {
  if (!fillable) return null;

  const selectedOption = options?.find(
    (option) => option.id === mapping.optionId
  );

  switch (mapping.kind) {
    case 'checkbox':
      return (
        <input
          aria-label={`PDF checkbox ${mapping.esheetFieldId}`}
          checked={preview.checked ?? false}
          type="checkbox"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onResponseChange({
              selected: event.currentTarget.checked
                ? { id: 'yes', value: 'Yes' }
                : { id: 'no', value: 'No' },
            })
          }
          className="ms:h-3.5 ms:w-3.5 ms:accent-msprimary"
        />
      );
    case 'radio':
      return (
        <input
          aria-label={`PDF radio option ${
            selectedOption?.value ?? mapping.esheetFieldId
          }`}
          checked={preview.checked ?? false}
          name={`pdf-radio-${mapping.esheetFieldId}`}
          type="radio"
          onClick={(event) => event.stopPropagation()}
          onChange={() =>
            onResponseChange({
              selected: selectedOption ?? {
                id: mapping.optionId ?? mapping.esheetFieldId,
                value: mapping.optionId ?? mapping.esheetFieldId,
              },
            })
          }
          className="ms:h-3.5 ms:w-3.5 ms:accent-msprimary"
        />
      );
    case 'dropdown': {
      const selectedDropdownOption = options?.find(
        (option) =>
          option.id === preview.value || option.value === preview.value
      );
      return (
        <select
          aria-label={`PDF dropdown ${mapping.esheetFieldId}`}
          value={selectedDropdownOption?.id ?? ''}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const option = options?.find(
              (candidate) => candidate.id === event.currentTarget.value
            );
            if (option) onResponseChange({ selected: option });
          }}
          className="ms:h-full ms:w-full ms:bg-transparent ms:px-1 ms:text-[10px] ms:text-mstext"
        >
          <option value="">Select</option>
          {options?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.value}
            </option>
          ))}
        </select>
      );
    }
    default:
      return (
        <input
          aria-label={`PDF text field ${mapping.esheetFieldId}`}
          value={preview.value ?? ''}
          type="text"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onResponseChange({ answer: event.currentTarget.value })
          }
          className="ms:h-full ms:w-full ms:border-0 ms:bg-transparent ms:px-1.5 ms:text-[10px] ms:text-mstext ms:outline-none"
        />
      );
  }
}

export const PdfCanvasPage = React.memo(function PdfCanvasPage({
  document,
  pageIndex,
  scale,
  mappings,
  selectedIndex,
  selectedRadioGroupName,
  editable = true,
  fillable = false,
  onSelect,
  onChange,
  onResponseChange,
  onActivatePage,
}: PdfCanvasPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [pageState, setPageState] = React.useState<PageState | null>(null);
  const [draftMapping, setDraftMapping] = React.useState<IndexedMapping | null>(
    null
  );
  const [alignmentGuides, setAlignmentGuides] =
    React.useState<AlignmentGuides | null>(null);

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
      if (!editable || !pageState) return;
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
      const candidates = alignmentCandidates(
        indexed.index,
        mappings,
        pageWidth,
        pageHeight
      );
      let current = original;
      let changed = false;

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
          const snappedX = snapPosition(
            clamp(pdfX, 0, pageWidth - width),
            width,
            candidates.vertical
          );
          const snappedY = snapPosition(
            clamp(pdfY, 0, pageHeight - height),
            height,
            candidates.horizontal
          );
          current = {
            ...original,
            rect: [
              clamp(snappedX.value, 0, pageWidth - width),
              clamp(snappedY.value, 0, pageHeight - height),
              width,
              height,
            ],
          };
          setAlignmentGuides({
            ...(snappedX.guide !== undefined && {
              vertical: snappedX.guide,
            }),
            ...(snappedY.guide !== undefined && {
              horizontal: snappedY.guide,
            }),
          });
        } else {
          const originalTop = original.rect[1] + original.rect[3];
          const snappedRight = snapPosition(
            clamp(
              original.rect[0] + original.rect[2] + deltaX / scale,
              original.rect[0] + 12,
              pageWidth
            ),
            0,
            candidates.vertical
          );
          const snappedBottom = snapPosition(
            clamp(
              originalTop - (original.rect[3] + deltaY / scale),
              0,
              originalTop - 12
            ),
            0,
            candidates.horizontal
          );
          const right = clamp(
            snappedRight.value,
            original.rect[0] + 12,
            pageWidth
          );
          const y = clamp(snappedBottom.value, 0, originalTop - 12);
          current = {
            ...original,
            rect: [
              original.rect[0],
              y,
              right - original.rect[0],
              originalTop - y,
            ],
          };
          setAlignmentGuides({
            ...(snappedRight.guide !== undefined && {
              vertical: snappedRight.guide,
            }),
            ...(snappedBottom.guide !== undefined && {
              horizontal: snappedBottom.guide,
            }),
          });
        }
        changed = true;
        setDraftMapping({ ...indexed, mapping: current });
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        setDraftMapping(null);
        setAlignmentGuides(null);
        if (changed) onChange(indexed.index, current);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp, { once: true });
    },
    [editable, mappings, onChange, onSelect, pageState, scale]
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
            {alignmentGuides?.vertical !== undefined && (
              <div
                aria-hidden="true"
                className="ms:pointer-events-none ms:absolute ms:inset-y-0 ms:z-20 ms:border-l ms:border-dashed ms:border-msprimary"
                style={{
                  left: viewport.convertToViewportPoint(
                    alignmentGuides.vertical,
                    0
                  )[0],
                }}
              />
            )}
            {alignmentGuides?.horizontal !== undefined && (
              <div
                aria-hidden="true"
                className="ms:pointer-events-none ms:absolute ms:inset-x-0 ms:z-20 ms:border-t ms:border-dashed ms:border-msprimary"
                style={{
                  top: viewport.convertToViewportPoint(
                    0,
                    alignmentGuides.horizontal
                  )[1],
                }}
              />
            )}
            {mappings.map((indexed) => {
              const displayed =
                draftMapping?.index === indexed.index ? draftMapping : indexed;
              const box = viewportRect(viewport, displayed.mapping.rect);
              const selected = indexed.index === selectedIndex;
              const isSelectedRadioGroup =
                indexed.mapping.kind === 'radio' &&
                indexed.mapping.pdfFieldName === selectedRadioGroupName;
              return (
                <div
                  key={`${displayed.mapping.pdfFieldName}:${
                    displayed.mapping.optionId ?? displayed.index
                  }`}
                  {...(editable
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        title: 'Drag to move PDF field',
                      }
                    : {})}
                  aria-label={`PDF field ${indexed.mapping.esheetFieldId}`}
                  onClick={(event) => {
                    if (!editable) return;
                    event.stopPropagation();
                    onSelect(indexed.index);
                  }}
                  onPointerDown={(event) => {
                    if (editable) beginInteraction(event, indexed, 'move');
                  }}
                  className={`ms:absolute ms:flex ms:items-center ms:overflow-visible ms:border ms:bg-white/85 ms:text-xs ms:text-mstext ms:transition-colors ${
                    selected
                      ? 'ms:z-10 ms:border-msprimary ms:ring-2 ms:ring-msprimary/30'
                      : isSelectedRadioGroup
                      ? 'ms:border-dashed ms:border-msprimary ms:ring-1 ms:ring-msprimary/30'
                      : 'ms:border-msprimary/45 ms:hover:border-msprimary'
                  } ${editable ? 'ms:cursor-move' : 'ms:cursor-default'}`}
                  style={{
                    left: box.left,
                    top: box.top,
                    width: Math.max(box.width, 10),
                    height: Math.max(box.height, 10),
                  }}
                >
                  <OverlayPreview
                    mapping={displayed.mapping}
                    options={indexed.options}
                    preview={displayed.preview}
                    fillable={fillable}
                    onResponseChange={(response) =>
                      onResponseChange(indexed.index, response)
                    }
                  />
                  {selected && editable && (
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
