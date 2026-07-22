import React from 'react';
import {
  applyPdfPlacementOverrides,
  applyPdfFieldLayout,
  generatePdf,
  importPdf,
  type GeneratedPdf,
  type PdfImportWarning,
  type PdfFieldMapping,
  type PdfFieldKind,
  type PdfPlacement,
} from '@esheet/pdf';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import type {
  FieldOption,
  FieldResponse,
  NormalizedDefinition,
} from '@esheet/core';
import { DownloadIcon, PdfIcon, XIcon } from '../icons.js';
import { useFormApi } from '../hooks/useFormApi.js';
import { PdfCanvasPage } from './PdfCanvasPage.js';
import { PdfPageThumbnail } from './PdfPageThumbnail.js';

const EMPTY_MAPPINGS: never[] = [];

const PDF_FIELD_TYPES = [
  { kind: 'text', fieldType: 'text', label: 'Text field' },
  { kind: 'checkbox', fieldType: 'boolean', label: 'Checkbox' },
  { kind: 'radio', fieldType: 'radio', label: 'Radio button' },
] as const satisfies readonly {
  kind: PdfFieldKind;
  fieldType: 'text' | 'boolean' | 'radio';
  label: string;
}[];

export interface ImportedPdfSession {
  sourcePdf: Uint8Array;
  mappings: PdfFieldMapping[];
  sourceFieldNames?: string[];
  warnings: PdfImportWarning[];
  pageCount: number;
}

export interface PdfViewProps {
  importedSession?: ImportedPdfSession | null;
  onImportedSessionChange?: (session: ImportedPdfSession | null) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withPdfPlacement(
  sourceData: unknown,
  placement: PdfPlacement
): Record<string, unknown> {
  const source = isRecord(sourceData) ? sourceData : {};
  const esheet = isRecord(source['esheet']) ? source['esheet'] : {};
  const pdf = isRecord(esheet['pdf']) ? esheet['pdf'] : {};
  return {
    ...source,
    esheet: { ...esheet, pdf: { ...pdf, placement } },
  };
}

function withoutPdfPlacement(sourceData: unknown): unknown {
  if (!isRecord(sourceData) || !isRecord(sourceData['esheet'])) {
    return sourceData;
  }
  const esheet = sourceData['esheet'];
  if (!isRecord(esheet['pdf']) || !('placement' in esheet['pdf'])) {
    return sourceData;
  }
  const { placement: _placement, ...pdf } = esheet['pdf'];
  void _placement;
  const { pdf: _pdf, ...restEheet } = esheet;
  void _pdf;
  const nextEsheet =
    Object.keys(pdf).length > 0 ? { ...restEheet, pdf } : restEheet;
  const { esheet: _esheet, ...restSource } = sourceData;
  void _esheet;
  return Object.keys(nextEsheet).length > 0
    ? { ...restSource, esheet: nextEsheet }
    : restSource;
}

function pdfPlacement(sourceData: unknown): PdfPlacement | undefined {
  if (!isRecord(sourceData) || !isRecord(sourceData['esheet'])) {
    return undefined;
  }
  const pdf = sourceData['esheet']['pdf'];
  if (!isRecord(pdf) || !isRecord(pdf['placement'])) return undefined;
  const placement = pdf['placement'];
  const page = placement['page'];
  const rect = placement['rect'];
  if (
    typeof page !== 'number' ||
    !Array.isArray(rect) ||
    rect.length !== 4 ||
    !rect.every((value) => typeof value === 'number')
  ) {
    return undefined;
  }
  return { page, rect: [rect[0], rect[1], rect[2], rect[3]] };
}

function pdfSourceFieldName(sourceData: unknown): string | undefined {
  if (!isRecord(sourceData)) return undefined;
  const fieldName = sourceData['fieldName'];
  return typeof fieldName === 'string' ? fieldName : undefined;
}

function sameGeometry(
  first: PdfFieldMapping,
  second: PdfFieldMapping
): boolean {
  return (
    first.page === second.page &&
    first.rect.every((value, index) => value === second.rect[index])
  );
}

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

function addedFieldName(
  fieldId: string,
  mappings: readonly PdfFieldMapping[]
): string {
  const base = fieldId;
  let name = base;
  let suffix = 2;
  const names = new Set(mappings.map((mapping) => mapping.pdfFieldName));
  while (names.has(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }
  return name;
}

function synchronizeRenamedMappings(
  mappings: readonly PdfFieldMapping[],
  normalized: NormalizedDefinition
): PdfFieldMapping[] {
  return mappings.flatMap((mapping) => {
    if (normalized.byId[mapping.esheetFieldId]) return mapping;
    const renamed = Object.values(normalized.byId).find(
      (node) =>
        pdfSourceFieldName(node.definition._sourceData) ===
        mapping.pdfFieldName
    );
    if (renamed) {
      return { ...mapping, esheetFieldId: renamed.definition.id };
    }
    const placedField = Object.values(normalized.byId).find((node) => {
      const placement = pdfPlacement(node.definition._sourceData);
      return (
        placement?.page === mapping.page &&
        placement?.rect.every(
          (value, rectIndex) => value === mapping.rect[rectIndex]
        )
      );
    });
    if (!placedField) return [];
    return {
      ...mapping,
      esheetFieldId: placedField.definition.id,
    };
  });
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

export function PdfView({
  importedSession,
  onImportedSessionChange,
}: PdfViewProps) {
  const { instanceId, normalized, responses, _form: form } = useFormApi();
  const [generated, setGenerated] = React.useState<GeneratedPdf | null>(null);
  const [localImported, setLocalImported] =
    React.useState<ImportedPdfSession | null>(null);
  const [document, setDocument] = React.useState<PDFDocumentProxy | null>(null);
  const [mappings, setMappings] = React.useState<PdfFieldMapping[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [activePage, setActivePage] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isAddFieldMenuOpen, setIsAddFieldMenuOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const pageSelectorRef = React.useRef<HTMLElement>(null);
  const pageRefs = React.useRef(new Map<number, HTMLDivElement>());
  const thumbnailRefs = React.useRef(new Map<number, HTMLDivElement>());
  const pendingNavigationPageRef = React.useRef<number | null>(null);
  const scrollSettleTimeoutRef = React.useRef<number | null>(null);
  const skipPlacementRegenerationRef = React.useRef(false);

  const imported =
    importedSession === undefined ? localImported : importedSession;
  const setImported = onImportedSessionChange ?? setLocalImported;
  const sourceBytes = imported?.sourcePdf ?? generated?.bytes;
  const isImported = imported !== null;
  const fieldCount = Object.keys(normalized.byId).length;

  const importFile = React.useCallback(
    async (file: File) => {
      setIsImporting(true);
      setError(null);
      try {
        const result = await importPdf(file);
        form
          .getState()
          .replaceDefinitionAndResponses(result.definition, result.responses);
        setImported({
          sourcePdf: result.sourcePdf,
          mappings: result.mappings,
          sourceFieldNames: Array.from(
            new Set(result.mappings.map((mapping) => mapping.pdfFieldName))
          ),
          warnings: result.warnings,
          pageCount: result.pageCount,
        });
        setGenerated(null);
        setMappings(result.mappings);
        setSelectedIndex(null);
        setActivePage(0);
        setZoom(1);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'The PDF could not be imported.'
        );
      } finally {
        setPendingFile(null);
        setIsImporting(false);
      }
    },
    [form]
  );

  const selectFile = React.useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (
        file.type !== 'application/pdf' &&
        !file.name.toLocaleLowerCase().endsWith('.pdf')
      ) {
        setError('Choose a PDF file to import.');
        return;
      }
      if (fieldCount > 0 || generated || imported) {
        setPendingFile(file);
        return;
      }
      void importFile(file);
    },
    [fieldCount, generated, importFile, imported]
  );

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(event.currentTarget.files?.[0]);
      event.currentTarget.value = '';
    },
    [selectFile]
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingFile(false);
      selectFile(event.dataTransfer.files[0]);
    },
    [selectFile]
  );

  React.useEffect(() => {
    if (!imported) return;
    setMappings(imported.mappings);
  }, [imported]);

  React.useEffect(() => {
    if (!imported) return;
    const nextMappings = synchronizeRenamedMappings(
      imported.mappings,
      normalized
    );
    if (
      nextMappings.length === imported.mappings.length &&
      nextMappings.every(
        (mapping, index) => mapping === imported.mappings[index]
      )
    ) {
      return;
    }
    setMappings(nextMappings);
    setImported({ ...imported, mappings: nextMappings });
  }, [imported, normalized, setImported]);

  React.useEffect(() => {
    if (imported) return;
    if (skipPlacementRegenerationRef.current) {
      skipPlacementRegenerationRef.current = false;
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      const definition = form.getState().hydrateDefinition();
      void generatePdf(definition)
        .then((result) => {
          if (cancelled) return;
          setGenerated(result);
          setMappings(applyPdfPlacementOverrides(definition, result.mappings));
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
  }, [form, imported, normalized]);

  React.useEffect(() => {
    if (!sourceBytes) return;
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;

    void Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
      .then(([pdfjs, workerModule]) => {
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        loadingTask = pdfjs.getDocument({ data: sourceBytes.slice() });
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
  }, [sourceBytes]);

  const commitMapping = React.useCallback(
    (index: number, mapping: PdfFieldMapping) => {
      setMappings((current) =>
        current.map((item, itemIndex) => (itemIndex === index ? mapping : item))
      );
      if (isImported && imported) {
        const field = form
          .getState()
          .getField(mapping.esheetFieldId)?.definition;
        if (field && !mapping.optionId) {
          form.getState().updateField(mapping.esheetFieldId, {
            _sourceData: withPdfPlacement(field._sourceData, {
              page: mapping.page,
              rect: mapping.rect,
            }),
          });
        }
        setImported({
          ...imported,
          mappings: imported.mappings.map((item, itemIndex) =>
            itemIndex === index ? mapping : item
          ),
        });
        return;
      }
      const baseline = generated?.mappings.find(
        (candidate) =>
          candidate.esheetFieldId === mapping.esheetFieldId &&
          candidate.optionId === mapping.optionId &&
          candidate.pdfFieldName === mapping.pdfFieldName
      );
      const field = form.getState().getField(mapping.esheetFieldId)?.definition;
      if (!field) return;
      skipPlacementRegenerationRef.current = true;
      const placement =
        baseline && sameGeometry(mapping, baseline)
          ? undefined
          : { page: mapping.page, rect: mapping.rect };

      if (mapping.optionId) {
        const options = (field as { options?: FieldOption[] }).options;
        if (!options) return;
        form.getState().updateField(mapping.esheetFieldId, {
          options: options.map((option) =>
            option.id !== mapping.optionId
              ? option
              : {
                  ...option,
                  _sourceData: placement
                    ? withPdfPlacement(option._sourceData, placement)
                    : withoutPdfPlacement(option._sourceData),
                }
          ),
        });
        return;
      }

      form.getState().updateField(mapping.esheetFieldId, {
        _sourceData: placement
          ? withPdfPlacement(field._sourceData, placement)
          : withoutPdfPlacement(field._sourceData),
      });
    },
    [form, generated, imported, isImported, setImported]
  );

  const addPdfField = React.useCallback((fieldType: (typeof PDF_FIELD_TYPES)[number]) => {
    const placement = {
      page: activePage,
      rect: [72, 620, 220, 28] as PdfFieldMapping['rect'],
    };
    if (isImported && imported) {
      const fieldId = form.getState().addField(fieldType.fieldType, {
        patch: {
          question: fieldType.label,
          _sourceData: withPdfPlacement(undefined, placement),
          ...(fieldType.kind === 'radio'
            ? { options: [{ id: 'option-1', value: 'Option 1' }] }
            : {}),
        },
      });
      if (!fieldId) return;
      const mapping: PdfFieldMapping = {
        esheetFieldId: fieldId,
        pdfFieldName: addedFieldName(fieldId, mappings),
        kind: fieldType.kind,
        ...placement,
        ...(fieldType.kind === 'radio' ? { optionId: 'option-1' } : {}),
      };
      const nextMappings = [...mappings, mapping];
      setMappings(nextMappings);
      setImported({ ...imported, mappings: nextMappings });
      setSelectedIndex(nextMappings.length - 1);
      setIsAddFieldMenuOpen(false);
      return;
    }
    form.getState().addField(fieldType.fieldType, {
      patch: {
        question: fieldType.label,
        _sourceData: withPdfPlacement(undefined, placement),
        ...(fieldType.kind === 'radio'
          ? { options: [{ id: 'option-1', value: 'Option 1' }] }
          : {}),
      },
    });
    setIsAddFieldMenuOpen(false);
  }, [
    activePage,
    form,
    imported,
    isImported,
    mappings,
    setImported,
  ]);

  const resetLayout = React.useCallback(() => {
    if (!generated || isImported) return;
    skipPlacementRegenerationRef.current = true;
    for (const node of Object.values(form.getState().normalized.byId)) {
      const field = node.definition;
      const fieldSourceData = withoutPdfPlacement(field._sourceData);
      const options = (field as { options?: FieldOption[] }).options;
      const nextOptions = options?.map((option) => ({
        ...option,
        _sourceData: withoutPdfPlacement(option._sourceData),
      }));
      const optionsChanged = nextOptions?.some(
        (option, index) => option._sourceData !== options?.[index]._sourceData
      );
      if (fieldSourceData === field._sourceData && !optionsChanged) {
        continue;
      }
      form.getState().updateField(field.id, {
        _sourceData: fieldSourceData,
        ...(optionsChanged && nextOptions ? { options: nextOptions } : {}),
      });
    }
    setMappings(generated.mappings);
    setSelectedIndex(null);
  }, [form, generated, isImported]);

  const handleDownload = React.useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      if (isImported && imported) {
        const sourceFieldNames = new Set(imported.sourceFieldNames);
        const definition = form.getState().hydrateDefinition();
        const bytes = await applyPdfFieldLayout(imported.sourcePdf, mappings, {
          addedFields: mappings.filter(
            (mapping) => !sourceFieldNames.has(mapping.pdfFieldName)
          ),
          definition,
        });
        const url = URL.createObjectURL(bytesToBlob(bytes));
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = safeFilename(definition.title ?? definition.id);
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        return;
      }
      if (!generated) return;
      const definition = form.getState().hydrateDefinition();
      const current = await generatePdf(definition, { responses });
      const bytes = await applyPdfFieldLayout(
        current.bytes,
        applyPdfPlacementOverrides(definition, current.mappings)
      );
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
  }, [
    form,
    generated,
    imported,
    isDownloading,
    isImported,
    mappings,
    responses,
  ]);

  const selectedMapping =
    selectedIndex === null ? undefined : mappings[selectedIndex];

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
      const distance = Math.abs(
        element.getBoundingClientRect().top - containerTop - 24
      );
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
    const byPage = new Map<
      number,
      {
        mapping: PdfFieldMapping;
        index: number;
        preview: { value?: string; checked?: boolean };
      }[]
    >();
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      const preview = previewForMapping(mapping);
      const list = byPage.get(mapping.page) ?? [];
      list.push({ mapping, index: i, preview });
      byPage.set(mapping.page, list);
    }
    return byPage;
  }, [mappings, previewForMapping]);

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDraggingFile(false);
      }}
      onDrop={handleDrop}
      className={`ms:relative ms:flex ms:h-full ms:max-h-full ms:min-h-[24rem] ms:flex-col ms:overflow-hidden ms:rounded-lg ms:border ms:bg-mssurface ${
        isDraggingFile
          ? 'ms:border-msprimary ms:ring-2 ms:ring-msprimary/30'
          : 'ms:border-msborder'
      }`}
    >
      <input
        ref={fileInputRef}
        id={`${instanceId}-pdf-import-file`}
        aria-label="Open PDF"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="ms:hidden"
      />
      <div className="ms:flex ms:min-h-14 ms:flex-wrap ms:items-center ms:justify-between ms:gap-3 ms:border-b ms:border-msborder ms:px-4 ms:py-2">
        <div className="ms:min-w-0">
          <div className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:font-semibold ms:text-mstext">
            <PdfIcon className="ms:h-4 ms:w-4 ms:text-msprimary" />
            PDF designer
          </div>
          {(generated || imported) && (
            <p className="ms:mt-0.5 ms:text-xs ms:text-mstextmuted">
              {imported?.pageCount ?? generated?.pageCount ?? 0} page
              {(imported?.pageCount ?? generated?.pageCount ?? 0) === 1
                ? ''
                : 's'}
              {' · '}
              {mappings.length} field{mappings.length === 1 ? '' : 's'}
              {' · '}
              {isImported
                ? 'Imported source and field layer'
                : 'Canvas and AcroForm layers'}
            </p>
          )}
        </div>

        <div className="ms:flex ms:flex-wrap ms:items-center ms:gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="ms:h-9 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:px-3 ms:text-xs ms:font-medium ms:text-mstext ms:disabled:cursor-not-allowed ms:disabled:opacity-50"
          >
            {isImporting ? 'Opening…' : 'Open PDF'}
          </button>
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
          <div className="ms:relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isAddFieldMenuOpen}
              onClick={() => setIsAddFieldMenuOpen((open) => !open)}
              disabled={!document}
              className="ms:inline-flex ms:h-9 ms:items-center ms:gap-2 ms:rounded-lg ms:border ms:border-msprimary ms:bg-msprimary ms:px-3 ms:text-xs ms:font-medium ms:text-white ms:disabled:cursor-not-allowed ms:disabled:opacity-50"
            >
              + Add field
            </button>
            {isAddFieldMenuOpen && (
              <div
                role="menu"
                className="ms:absolute ms:right-0 ms:top-10 ms:z-30 ms:min-w-36 ms:overflow-hidden ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-1 ms:shadow-lg"
              >
                {PDF_FIELD_TYPES.map((fieldType) => (
                  <button
                    key={fieldType.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => addPdfField(fieldType)}
                    className="ms:flex ms:w-full ms:items-center ms:px-3 ms:py-2 ms:text-left ms:text-xs ms:text-mstext ms:hover:bg-msbackgroundhover"
                  >
                    {fieldType.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={resetLayout}
            disabled={!generated || isImported}
            className="ms:h-9 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:px-3 ms:text-xs ms:font-medium ms:text-mstext ms:disabled:opacity-50"
          >
            Reset layout
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={(!generated && !imported) || isLoading || isDownloading}
            className="ms:inline-flex ms:h-9 ms:items-center ms:gap-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:px-3 ms:text-xs ms:font-medium ms:text-mstext ms:transition-colors ms:hover:border-msprimary ms:hover:bg-msprimary ms:hover:text-white ms:disabled:cursor-not-allowed ms:disabled:opacity-50"
          >
            <DownloadIcon className="ms:h-4 ms:w-4" />
            {isDownloading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="ms:border-b ms:border-red-300 ms:bg-red-50 ms:px-4 ms:py-2 ms:text-xs ms:text-red-700"
        >
          {error}
        </div>
      )}

      {imported && imported.warnings.length > 0 && (
        <div
          role="status"
          className="ms:border-b ms:border-amber-300 ms:bg-amber-50 ms:px-4 ms:py-2 ms:text-xs ms:text-amber-800"
        >
          {imported.warnings.map((warning) => warning.message).join(' ')}
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
          {!document && !isLoading && fieldCount === 0 && !error && (
            <div className="ms:absolute ms:inset-0 ms:flex ms:items-center ms:justify-center ms:p-8">
              <div className="ms:max-w-md ms:text-center">
                <PdfIcon className="ms:mx-auto ms:mb-3 ms:h-10 ms:w-10 ms:text-mstextmuted" />
                <h2 className="ms:text-base ms:font-semibold ms:text-mstext">
                  Open a PDF or add fields
                </h2>
                <p className="ms:mt-2 ms:text-sm ms:text-mstextmuted">
                  Drop a PDF anywhere in this workspace, or choose one to import
                  its AcroForm fields.
                </p>
              </div>
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
                    mappings={
                      indexedMappingsByPage.get(pageIndex) ?? EMPTY_MAPPINGS
                    }
                    selectedIndex={selectedIndex}
                    editable
                    onSelect={setSelectedIndex}
                    onChange={commitMapping}
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
                {(['x', 'y', 'width', 'height'] as const).map(
                  (label, rectIndex) => (
                    <div key={label}>
                      <dt className="ms:capitalize ms:text-mstextmuted">
                        {label}
                      </dt>
                      <dd className="ms:mt-1 ms:font-mono ms:text-mstext">
                        {selectedMapping.rect[rectIndex].toFixed(1)}
                      </dd>
                    </div>
                  )
                )}
              </dl>
              <p className="ms:text-xs ms:leading-relaxed ms:text-mstextmuted">
                {isImported
                  ? 'Select a text field in Build mode, then add it here. Drag or resize mapped widgets before downloading the enhanced PDF.'
                  : 'Drag the move handle or resize from the lower-right corner. The edited rectangle is written back to the AcroForm when downloaded.'}
              </p>
            </div>
          ) : (
            <div className="ms:text-sm ms:text-mstextmuted">
              Select an AcroForm field on the page to edit its position and
              size.
            </div>
          )}
        </aside>
      </div>

      {pendingFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${instanceId}-pdf-import-title`}
          className="ms:absolute ms:inset-0 ms:z-30 ms:flex ms:items-center ms:justify-center ms:bg-black/40 ms:p-4"
        >
          <div className="ms:w-full ms:max-w-md ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-5 ms:shadow-xl">
            <h2
              id={`${instanceId}-pdf-import-title`}
              className="ms:text-base ms:font-semibold ms:text-mstext"
            >
              Replace the current questionnaire?
            </h2>
            <p className="ms:mt-2 ms:text-sm ms:text-mstextmuted">
              Opening {pendingFile.name} replaces the current questionnaire and
              its responses.
            </p>
            <div className="ms:mt-4 ms:flex ms:justify-end ms:gap-2">
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="ms:h-9 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:px-3 ms:text-xs ms:font-medium ms:text-mstext"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void importFile(pendingFile)}
                className="ms:h-9 ms:rounded-lg ms:border ms:border-msprimary ms:bg-msprimary ms:px-3 ms:text-xs ms:font-medium ms:text-white"
              >
                Replace and open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
