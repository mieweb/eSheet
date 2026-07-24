import React from 'react';
import type { FieldDefinition, FieldResponse, FormStore } from '@esheet/core';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { PdfFieldMapping } from '@esheet/pdf';

export interface RendererPdfViewProps {
  sourcePdf: Uint8Array;
  mappings: readonly PdfFieldMapping[];
  form: FormStore;
}

interface PageState {
  viewport: PageViewport;
}

function viewportRect(
  viewport: PageViewport,
  rect: PdfFieldMapping['rect']
): { left: number; top: number; width: number; height: number } {
  const [x, y, width, height] = rect;
  const first = viewport.convertToViewportPoint(x, y);
  const second = viewport.convertToViewportPoint(x + width, y + height);
  return {
    left: Math.min(first[0], second[0]),
    top: Math.min(first[1], second[1]),
    width: Math.abs(second[0] - first[0]),
    height: Math.abs(second[1] - first[1]),
  };
}

function selectedValues(response: FieldResponse | undefined): string[] {
  const selected = response?.selected;
  if (!selected) return [];
  if (Array.isArray(selected)) {
    return selected.flatMap((option) => [option.id, option.value]);
  }
  if (
    typeof selected === 'object' &&
    typeof selected.id === 'string' &&
    typeof selected.value === 'string'
  ) {
    return [selected.id, selected.value];
  }
  return [];
}

function fieldOptions(field: FieldDefinition | undefined) {
  return field && 'options' in field ? field.options ?? [] : [];
}

function PdfFieldControl({
  instanceId,
  mapping,
  field,
  response,
  onResponseChange,
}: {
  instanceId: string;
  mapping: PdfFieldMapping;
  field: FieldDefinition | undefined;
  response: FieldResponse | undefined;
  onResponseChange: (response: FieldResponse) => void;
}) {
  const options = fieldOptions(field);
  const inputId = `${instanceId}-pdf-${mapping.kind}-answer-${
    mapping.esheetFieldId
  }-${mapping.optionId ?? 'field'}`;

  if (mapping.kind === 'checkbox') {
    const checked = selectedValues(response)
      .map((value) => value.toLowerCase())
      .some((value) => ['true', 'yes', '1'].includes(value));
    return (
      <input
        id={inputId}
        aria-label={`PDF checkbox ${mapping.esheetFieldId}`}
        checked={checked}
        type="checkbox"
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
  }

  if (mapping.kind === 'radio') {
    const option = options.find(
      (candidate) => candidate.id === mapping.optionId
    );
    const checked = selectedValues(response).includes(
      option?.id ?? mapping.optionId ?? mapping.esheetFieldId
    );
    return (
      <input
        id={inputId}
        aria-label={`PDF radio option ${
          option?.value ?? mapping.esheetFieldId
        }`}
        checked={checked}
        name={`${instanceId}-pdf-radio-${mapping.esheetFieldId}`}
        type="radio"
        onChange={() =>
          onResponseChange({
            selected: option ?? {
              id: mapping.optionId ?? mapping.esheetFieldId,
              value: mapping.optionId ?? mapping.esheetFieldId,
            },
          })
        }
        className="ms:h-3.5 ms:w-3.5 ms:accent-msprimary"
      />
    );
  }

  if (mapping.kind === 'dropdown') {
    const selected = selectedValues(response)[0] ?? '';
    return (
      <select
        id={inputId}
        aria-label={`PDF dropdown ${mapping.esheetFieldId}`}
        value={selected}
        onChange={(event) => {
          const option = options.find(
            (candidate) => candidate.id === event.currentTarget.value
          );
          if (option) onResponseChange({ selected: option });
        }}
        className="ms:h-full ms:w-full ms:bg-transparent ms:px-1 ms:text-[10px] ms:text-mstext"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.value}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={inputId}
      aria-label={`PDF text field ${mapping.esheetFieldId}`}
      value={response?.answer ?? ''}
      type="text"
      onChange={(event) =>
        onResponseChange({ answer: event.currentTarget.value })
      }
      className="ms:h-full ms:w-full ms:border-0 ms:bg-transparent ms:px-1.5 ms:text-[10px] ms:text-mstext ms:outline-none"
    />
  );
}

function PdfPage({
  document,
  pageIndex,
  mappings,
  form,
  instanceId,
}: {
  document: PDFDocumentProxy;
  pageIndex: number;
  mappings: readonly PdfFieldMapping[];
  form: FormStore;
  instanceId: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [pageState, setPageState] = React.useState<PageState | null>(null);
  const responses = React.useSyncExternalStore(
    (callback) => form.subscribe(callback),
    () => form.getState().responses,
    () => form.getState().responses
  );

  React.useEffect(() => {
    let disposed = false;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;
    void document
      .getPage(pageIndex + 1)
      .then((page) => {
        if (disposed) return;
        const viewport = page.getViewport({ scale: 1 });
        setPageState({ viewport });
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
          annotationMode: 0,
        });
        return renderTask.promise;
      })
      .catch((reason: unknown) => {
        if (!disposed)
          console.error('Unable to render PDF canvas page.', reason);
      });

    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [document, pageIndex]);

  const viewport = pageState?.viewport;
  return (
    <div className="ms:relative ms:shrink-0 ms:bg-white ms:shadow-lg ms:ring-1 ms:ring-black/10">
      <canvas ref={canvasRef} className="ms:block" />
      {viewport && (
        <div
          className="ms:pointer-events-auto ms:absolute ms:inset-0 ms:z-10"
          aria-label="AcroForm field layer"
          style={{
            width: viewport.width,
            height: viewport.height,
            pointerEvents: 'auto',
            zIndex: 1,
          }}
        >
          {mappings.map((mapping) => {
            const box = viewportRect(viewport, mapping.rect);
            const field = form
              .getState()
              .getField(mapping.esheetFieldId)?.definition;
            return (
              <div
                key={`${mapping.pdfFieldName}:${
                  mapping.optionId ?? mapping.esheetFieldId
                }`}
                aria-label={`PDF field ${mapping.esheetFieldId}`}
                className="ms:absolute ms:flex ms:items-center ms:border ms:border-msprimary/45 ms:bg-white/85"
                style={{
                  left: box.left,
                  top: box.top,
                  width: Math.max(box.width, 10),
                  height: Math.max(box.height, 10),
                  pointerEvents: 'auto',
                }}
              >
                <PdfFieldControl
                  instanceId={instanceId}
                  mapping={mapping}
                  field={field}
                  response={responses[mapping.esheetFieldId]}
                  onResponseChange={(response) =>
                    form.getState().setResponse(mapping.esheetFieldId, response)
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RendererPdfView({
  sourcePdf,
  mappings,
  form,
}: RendererPdfViewProps) {
  const [document, setDocument] = React.useState<PDFDocumentProxy | null>(null);
  const [activePage, setActivePage] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const instanceId = React.useId();

  React.useEffect(() => {
    let cancelled = false;
    let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setError(null);
    setActivePage(0);

    void Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
      .then(([pdfjs, workerModule]) => {
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        loadingTask = pdfjs.getDocument({ data: sourcePdf.slice() });
        return loadingTask.promise;
      })
      .then((loadedDocument) => {
        if (cancelled || !loadedDocument) return;
        setDocument(loadedDocument);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'The PDF canvas could not be rendered.'
        );
      });

    return () => {
      cancelled = true;
      setDocument(null);
      void loadingTask?.destroy();
    };
  }, [sourcePdf]);

  if (error) {
    return <div role="alert">{error}</div>;
  }
  if (!document) {
    return <div role="status">Loading PDF preview...</div>;
  }

  const pageMappings = mappings.filter(
    (mapping) => mapping.page === activePage
  );
  return (
    <div className="ms:flex ms:h-full ms:min-h-0 ms:flex-col ms:gap-3">
      <div className="ms:flex ms:items-center ms:justify-center ms:gap-2">
        <button
          type="button"
          aria-label="Previous PDF page"
          disabled={activePage === 0}
          onClick={() => setActivePage((page) => Math.max(page - 1, 0))}
          className="ms:rounded ms:border ms:border-msborder ms:px-3 ms:py-1.5 ms:text-sm ms:disabled:opacity-50"
        >
          Previous
        </button>
        <span className="ms:text-sm ms:text-mstextmuted">
          Page {activePage + 1} of {document.numPages}
        </span>
        <button
          type="button"
          aria-label="Next PDF page"
          disabled={activePage >= document.numPages - 1}
          onClick={() =>
            setActivePage((page) => Math.min(page + 1, document.numPages - 1))
          }
          className="ms:rounded ms:border ms:border-msborder ms:px-3 ms:py-1.5 ms:text-sm ms:disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="ms:min-h-0 ms:flex-1 ms:overflow-auto ms:p-3">
        <div className="ms:flex ms:min-h-full ms:justify-center">
          <PdfPage
            document={document}
            pageIndex={activePage}
            mappings={pageMappings}
            form={form}
            instanceId={instanceId}
          />
        </div>
      </div>
    </div>
  );
}
