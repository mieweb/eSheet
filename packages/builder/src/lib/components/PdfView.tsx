import React from 'react';
import {
  applyPdfFieldLayout,
  generatePdf,
  type GeneratedPdf,
  type PdfFieldMapping,
} from '@esheet/pdf';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
} from 'pdfjs-dist';
import type { FieldResponse } from '@esheet/core';
import { DownloadIcon, PdfIcon, XIcon } from '../icons.js';
import { useFormApi } from '../hooks/useFormApi.js';
import { PdfCanvasPage } from './PdfCanvasPage.js';
import { PdfPageThumbnail } from './PdfPageThumbnail.js';

const EMPTY_MAPPINGS: never[] = [];

function bytesToBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}

function safeFilename(value: string): string {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${name || 'esheet-form'}.pdf`;
}

function mappingLabel(mapping: PdfFieldMapping): string {
  const suffix = mapping.optionId ? ` / ${mapping.optionId}` : '';
  return `${mapping.esheetFieldId}${suffix}`;
}

function selectedValues(response: FieldResponse | undefined): string[] {
  const selected = response?.selected;
  if (!selected) return [];
  if (Array.isArray(selected)) {
    return selected.flatMap((option) => [option.id, option.value]);
  }
  if (
    'id' in selected &&
    typeof selected.id === 'string' &&
    'value' in selected &&
    typeof selected.value === 'string'
  ) {
    return [selected.id, selected.value];
  }
  return [];
}

export function PdfView() {
  const { normalized, responses, _form: form } = useFormApi();
  const [generated, setGenerated] = React.useState<GeneratedPdf | null>(null);
  const [document, setDocument] = React.useState<PDFDocumentProxy | null>(null);
  const [mappings, setMappings] = React.useState<PdfFieldMapping[]>([]);
  const [addedFieldNames, setAddedFieldNames] = React.useState<Set<string>>(
    () => new Set()
  );
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [activePage, setActivePage] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const pageSelectorRef = React.useRef<HTMLElement>(null);
  const pageRefs = React.useRef(new Map<number, HTMLDivElement>());
  const thumbnailRefs = React.useRef(new Map<number, HTMLDivElement>());
  const pendingNavigationPageRef = React.useRef<number | null>(null);
  const scrollSettleTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      const definition = form.getState().hydrateDefinition();
      void generatePdf(definition, { responses })
        .then((result) => {
          if (cancelled) return;
          setGenerated(result);
          setMappings(result.mappings);
          setAddedFieldNames(new Set());
          setSelectedIndex(null);
          setActivePage(0);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setGenerated(null);
          setError(
            reason instanceof Error
              ? reason.message
              : 'The PDF preview could not be generated.'
          );
          setIsLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form, normalized, responses]);

  React.useEffect(() => {
    if (!generated) return;
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;

    void Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
      .then(([pdfjs, workerModule]) => {
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        loadingTask = pdfjs.getDocument({ data: generated.bytes.slice() });
        void loadingTask.promise
          .then((loadedDocument) => {
            if (cancelled) return;
            setDocument(loadedDocument);
            setIsLoading(false);
          })
          .catch((reason: unknown) => {
            if (cancelled) return;
            setDocument(null);
            setError(
              reason instanceof Error
                ? reason.message
                : 'The PDF canvas could not be rendered.'
            );
            setIsLoading(false);
          });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'The PDF viewer could not be loaded.'
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      setDocument(null);
      void loadingTask?.destroy();
    };
  }, [generated]);

  const updateMapping = React.useCallback(
    (index: number, mapping: PdfFieldMapping) => {
      setMappings((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? mapping : item
        )
      );
    },
    []
  );

  const addTextField = React.useCallback(() => {
    const suffix = `${Date.now().toString(36)}_${mappings.length}`;
    const name = `esheet_custom_${suffix}`;
    const mapping: PdfFieldMapping = {
      esheetFieldId: `pdf-custom-${suffix}`,
      pdfFieldName: name,
      kind: 'text',
      page: activePage,
      rect: [72, 620, 220, 28],
    };
    setMappings((current) => {
      setSelectedIndex(current.length);
      return [...current, mapping];
    });
    setAddedFieldNames((current) => new Set(current).add(name));
  }, [activePage, mappings.length]);

  const resetLayout = React.useCallback(() => {
    if (!generated) return;
    setMappings(generated.mappings);
    setAddedFieldNames(new Set());
    setSelectedIndex(null);
  }, [generated]);

  const handleDownload = React.useCallback(async () => {
    if (!generated || isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      const addedFields = mappings.filter((mapping) =>
        addedFieldNames.has(mapping.pdfFieldName)
      );
      const bytes = await applyPdfFieldLayout(generated.bytes, mappings, {
        addedFields,
      });
      const definition = form.getState().hydrateDefinition();
      const url = URL.createObjectURL(bytesToBlob(bytes));
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = safeFilename(definition.title ?? definition.id);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The edited PDF could not be downloaded.'
      );
    } finally {
      setIsDownloading(false);
    }
  }, [addedFieldNames, form, generated, isDownloading, mappings]);

  const selectedMapping =
    selectedIndex === null ? undefined : mappings[selectedIndex];
  const fieldCount = Object.keys(normalized.byId).length;

  const goToPage = React.useCallback((pageIndex: number) => {
    pendingNavigationPageRef.current = pageIndex;
    if (scrollSettleTimeoutRef.current !== null) {
      window.clearTimeout(scrollSettleTimeoutRef.current);
      scrollSettleTimeoutRef.current = null;
    }
    setActivePage(pageIndex);
    const page = pageRefs.current.get(pageIndex);
    if (!page) {
      pendingNavigationPageRef.current = null;
      return;
    }
    page.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const syncActivePageFromScrollPosition = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let closestPage = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const [pageIndex, element] of pageRefs.current) {
      const distance = Math.abs(element.getBoundingClientRect().top - containerTop - 24);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageIndex;
      }
    }
    setActivePage(closestPage);
  }, []);

  const updateActivePageFromScroll = React.useCallback(() => {
    if (pendingNavigationPageRef.current === null) {
      syncActivePageFromScrollPosition();
      return;
    }

    if (scrollSettleTimeoutRef.current !== null) {
      window.clearTimeout(scrollSettleTimeoutRef.current);
    }
    scrollSettleTimeoutRef.current = window.setTimeout(() => {
      pendingNavigationPageRef.current = null;
      scrollSettleTimeoutRef.current = null;
      syncActivePageFromScrollPosition();
    }, 150);
  }, [syncActivePageFromScrollPosition]);

  React.useEffect(
    () => () => {
      if (scrollSettleTimeoutRef.current !== null) {
        window.clearTimeout(scrollSettleTimeoutRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    const selector = pageSelectorRef.current;
    const thumbnail = thumbnailRefs.current.get(activePage);
    if (!selector || !thumbnail) return;

    const selectorRect = selector.getBoundingClientRect();
    const thumbnailRect = thumbnail.getBoundingClientRect();
    if (thumbnailRect.top < selectorRect.top) {
      selector.scrollTop -= selectorRect.top - thumbnailRect.top;
    } else if (thumbnailRect.bottom > selectorRect.bottom) {
      selector.scrollTop += thumbnailRect.bottom - selectorRect.bottom;
    }
  }, [activePage]);

  const previewForMapping = React.useCallback(
    (mapping: PdfFieldMapping) => {
      const response = responses[mapping.esheetFieldId];
      const selected = selectedValues(response);
      if (mapping.kind === 'checkbox' || mapping.kind === 'radio') {
        const optionMatches = mapping.optionId
          ? selected.includes(mapping.optionId)
          : selected.some((value) =>
              ['true', 'yes', '1'].includes(value.toLowerCase())
            );
        return { checked: optionMatches };
      }
      if (mapping.kind === 'dropdown') {
        return { value: selected.at(-1) ?? '' };
      }
      return {
        value:
          (mapping.optionId
            ? response?.multitextAnswers?.[mapping.optionId]
            : response?.answer) ?? '',
      };
    },
    [responses]
  );

  const indexedMappingsByPage = React.useMemo(() => {
    const byPage = new Map<number, { mapping: PdfFieldMapping; index: number; preview: { value?: string; checked?: boolean } }[]>();
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      const preview = previewForMapping(mapping);
      const list = byPage.get(mapping.page) ?? [];
      list.push({ mapping, index: i, preview });
      byPage.set(mapping.page, list);
    }
    return byPage;
  }, [mappings, previewForMapping]);

  if (fieldCount === 0 && !isLoading) {
    return (
      <div className="ms:flex ms:h-full ms:min-h-[24rem] ms:items-center ms:justify-center ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-8">
        <div className="ms:max-w-md ms:text-center">
          <PdfIcon className="ms:mx-auto ms:mb-3 ms:h-10 ms:w-10 ms:text-mstextmuted" />
          <h2 className="ms:text-base ms:font-semibold ms:text-mstext">
            Add fields to generate a PDF
          </h2>
          <p className="ms:mt-2 ms:text-sm ms:text-mstextmuted">
            Build your questionnaire first, then return here to design its
            fillable AcroForm PDF.
          </p>
        </div>
      </div>
    );
  }

  if (error && !generated) {
    return (
      <div
        role="alert"
        className="ms:flex ms:h-full ms:min-h-[24rem] ms:items-center ms:justify-center ms:rounded-lg ms:border ms:border-red-300 ms:bg-red-50 ms:p-8"
      >
        <div className="ms:max-w-lg ms:text-center">
          <h2 className="ms:text-base ms:font-semibold ms:text-red-800">
            PDF workspace unavailable
          </h2>
          <p className="ms:mt-2 ms:text-sm ms:text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ms:flex ms:h-full ms:max-h-full ms:min-h-[24rem] ms:flex-col ms:overflow-hidden ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
      <div className="ms:flex ms:min-h-14 ms:flex-wrap ms:items-center ms:justify-between ms:gap-3 ms:border-b ms:border-msborder ms:px-4 ms:py-2">
        <div className="ms:min-w-0">
          <div className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:font-semibold ms:text-mstext">
            <PdfIcon className="ms:h-4 ms:w-4 ms:text-msprimary" />
            PDF designer
          </div>
          {generated && (
            <p className="ms:mt-0.5 ms:text-xs ms:text-mstextmuted">
              {generated.pageCount} page{generated.pageCount === 1 ? '' : 's'}
              {' · '}
              {mappings.length} field{mappings.length === 1 ? '' : 's'}
              {' · Canvas and AcroForm layers'}
            </p>
          )}
        </div>

        <div className="ms:flex ms:flex-wrap ms:items-center ms:gap-2">
          <div className="ms:flex ms:items-center ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
              className="ms:h-8 ms:w-8 ms:border-0 ms:bg-transparent ms:text-base ms:text-mstext ms:cursor-pointer"
            >
              −
            </button>
            <span className="ms:min-w-14 ms:text-center ms:text-xs ms:text-mstextmuted">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}
              className="ms:h-8 ms:w-8 ms:border-0 ms:bg-transparent ms:text-base ms:text-mstext ms:cursor-pointer"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={addTextField}
            disabled={!document}
            className="ms:inline-flex ms:h-9 ms:items-center ms:gap-2 ms:rounded-lg ms:border ms:border-msprimary ms:bg-msprimary ms:px-3 ms:text-xs ms:font-medium ms:text-white ms:disabled:cursor-not-allowed ms:disabled:opacity-50"
          >
            + Text field
          </button>
          <button
            type="button"
            onClick={resetLayout}
            disabled={!generated}
            className="ms:h-9 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:px-3 ms:text-xs ms:font-medium ms:text-mstext ms:disabled:opacity-50"
          >
            Reset layout
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!generated || isLoading || isDownloading}
            className="ms:inline-flex ms:h-9 ms:items-center ms:gap-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:px-3 ms:text-xs ms:font-medium ms:text-mstext ms:transition-colors ms:hover:border-msprimary ms:hover:bg-msprimary ms:hover:text-white ms:disabled:cursor-not-allowed ms:disabled:opacity-50"
          >
            <DownloadIcon className="ms:h-4 ms:w-4" />
            {isDownloading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="ms:border-b ms:border-red-300 ms:bg-red-50 ms:px-4 ms:py-2 ms:text-xs ms:text-red-700">
          {error}
        </div>
      )}

      <div className="ms:flex ms:min-h-0 ms:flex-1 ms:overflow-hidden ms:bg-slate-200">
        {document && document.numPages > 1 && (
          <nav
            ref={pageSelectorRef}
            aria-label="PDF pages"
            className="ms:w-28 ms:shrink-0 ms:overflow-y-auto ms:overscroll-contain ms:border-r ms:border-msborder ms:bg-mssurface ms:p-2 ms:sm:w-36"
          >
            <div className="ms:flex ms:flex-col ms:gap-2">
              {Array.from({ length: document.numPages }, (_, pageIndex) => (
                <div
                  key={pageIndex}
                  ref={(element) => {
                    if (element) thumbnailRefs.current.set(pageIndex, element);
                    else thumbnailRefs.current.delete(pageIndex);
                  }}
                >
                  <PdfPageThumbnail
                    document={document}
                    pageIndex={pageIndex}
                    active={activePage === pageIndex}
                    onSelect={goToPage}
                  />
                </div>
              ))}
            </div>
          </nav>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={updateActivePageFromScroll}
          className="ms:relative ms:min-h-0 ms:min-w-0 ms:flex-1 ms:overflow-auto ms:overscroll-contain ms:p-6"
        >
          {isLoading && (
            <div
              role="status"
              className="ms:absolute ms:inset-0 ms:z-20 ms:flex ms:items-center ms:justify-center ms:bg-mssurface/90 ms:text-sm ms:text-mstextmuted"
            >
              Rendering PDF canvas…
            </div>
          )}
          {document && (
            <div className="ms:flex ms:flex-col ms:items-center ms:gap-8">
              {Array.from({ length: document.numPages }, (_, pageIndex) => (
                <div
                  key={pageIndex}
                  ref={(element) => {
                    if (element) pageRefs.current.set(pageIndex, element);
                    else pageRefs.current.delete(pageIndex);
                  }}
                  className="ms:scroll-mt-6"
                >
                  <PdfCanvasPage
                    document={document}
                    pageIndex={pageIndex}
                    scale={zoom}
                    mappings={indexedMappingsByPage.get(pageIndex) ?? EMPTY_MAPPINGS}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                    onChange={updateMapping}
                    onActivatePage={setActivePage}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="ms:hidden ms:w-72 ms:shrink-0 ms:border-l ms:border-msborder ms:bg-mssurface ms:p-4 ms:lg:block">
          {selectedMapping && selectedIndex !== null ? (
            <div className="ms:flex ms:flex-col ms:gap-4">
              <div className="ms:flex ms:items-start ms:justify-between ms:gap-2">
                <div className="ms:min-w-0">
                  <div className="ms:text-xs ms:font-semibold ms:uppercase ms:tracking-wide ms:text-msprimary">
                    Selected field
                  </div>
                  <div className="ms:mt-1 ms:truncate ms:text-sm ms:font-medium ms:text-mstext">
                    {mappingLabel(selectedMapping)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Deselect PDF field"
                  onClick={() => setSelectedIndex(null)}
                  className="ms:flex ms:h-7 ms:w-7 ms:items-center ms:justify-center ms:rounded-md ms:border ms:border-msborder ms:bg-msbackground"
                >
                  <XIcon className="ms:h-3.5 ms:w-3.5" />
                </button>
              </div>
              <dl className="ms:grid ms:grid-cols-2 ms:gap-3 ms:text-xs">
                <div>
                  <dt className="ms:text-mstextmuted">Type</dt>
                  <dd className="ms:mt-1 ms:font-medium ms:text-mstext">
                    {selectedMapping.kind}
                  </dd>
                </div>
                <div>
                  <dt className="ms:text-mstextmuted">Page</dt>
                  <dd className="ms:mt-1 ms:font-medium ms:text-mstext">
                    {selectedMapping.page + 1}
                  </dd>
                </div>
                {(['x', 'y', 'width', 'height'] as const).map((label, rectIndex) => (
                  <div key={label}>
                    <dt className="ms:capitalize ms:text-mstextmuted">{label}</dt>
                    <dd className="ms:mt-1 ms:font-mono ms:text-mstext">
                      {selectedMapping.rect[rectIndex].toFixed(1)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="ms:text-xs ms:leading-relaxed ms:text-mstextmuted">
                Drag the move handle or resize from the lower-right corner. The
                edited rectangle is written back to the AcroForm when downloaded.
              </p>
            </div>
          ) : (
            <div className="ms:text-sm ms:text-mstextmuted">
              Select an AcroForm field on the page to edit its position and size.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
