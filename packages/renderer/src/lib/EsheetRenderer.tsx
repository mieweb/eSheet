import React from 'react';
import {
  createFormStore,
  createUIStore,
  normalizeResponses,
  hydrateDefinition,
  validateForm,
  type CollabDecorations,
  type FormResponse,
  type FormStore,
  type UIStore,
  type ValidationError,
} from '@esheet/core';
import {
  exportResponseToFhir,
  type FhirFormMeta,
  type FhirQuestionnaireResponse,
  type ResponseExportOptions,
} from '@esheet/adapters';
import { createRendererTools, type RendererTools } from './renderer-tools.js';
import {
  FormStoreContext,
  UIContext,
  ZodIssuesPanel,
  FeedbackModal,
  useTouchMode,
} from '@esheet/fields';
import { ensureDefaultFieldComponentsRegistered } from './register-defaults.js';
import { useRendererInit } from './hooks/useRendererInit.js';
import { RendererBody } from './components/RendererBody.js';
import { RendererPdfView } from './components/RendererPdfView.js';
import type { PdfFieldMapping, PdfImportWarning, PdfSource } from '@esheet/pdf';

export type RendererRepresentation = 'esheet' | 'pdf';

interface EsheetRendererCommonProps {
  /** Form definition — accepts FormDefinition, SurveyJS schema, MCP elicitation envelope,
   *  or any of the above as a JSON/YAML string. Auto-detected and converted internally.
   *  Set `strict` to disable auto-conversion and require a valid FormDefinition directly. */
  /** Additional CSS classes for root container */
  className?: string;
  /** Initial form responses (pre-fill data) */
  initialResponses?: FormResponse;
  /** When true, allows `dangerouslyAllowJS: true` in the loaded schema to take effect —
   *  enabling field calculations and `conditionType: 'js'` conditions.
   *  When `false` (default), dangerous JS never executes regardless of schema content.
   *  Only set to `true` when you fully control and trust the form schemas being rendered. */
  allowDangerousJS?: boolean;
  /** When true, disables auto-detection of MCP/SurveyJS formats.
   *  Only accepts a valid eSheet FormDefinition (or JSON/YAML string thereof). */
  strict?: boolean;
  /** Called after the form definition has been parsed and loaded into the store. */
  onReady?: () => void;
  /**
   * Called once after the renderer mounts, providing a narrow `RendererTools`
   * facade for MCP / AI tool integrations.
   */
  onRendererToolsReady?: (tools: RendererTools) => void;
  /**
   * When provided, a submit button is rendered at the bottom of the form.
   * Called with the form response after all hard errors pass.
   * If soft-required fields are unanswered, a bypass popup is shown first.
   */
  onSubmit?: (response: FormResponse) => void;
  /** Label for the submit button. Defaults to `'Submit'`. */
  submitLabel?: string;
  /**
   * Enable touch-optimized mode with larger touch targets.
   * - `true`: Always enable touch mode
   * - `false`: Never enable touch mode (CSS media query still applies)
   * - `'auto'`: Enable based on viewport width (<980px) via JavaScript
   * - `undefined`: Rely on CSS media query only (default)
   */
  touchMode?: boolean | 'auto';
  /**
   * Called when touch mode changes (via auto-detection or programmatic toggle).
   * Useful for syncing external UI with the renderer's touch state.
   */
  onTouchModeChange?: (enabled: boolean) => void;
  /**
   * Optional host-supplied collaboration decorations (presence dots and
   * change-proposal adornments per field). The renderer only displays what
   * it is given — the host owns the collaboration transport.
   */
  collab?: CollabDecorations;
  /**
   * When true, the renderer fills its host container with no max-width cap,
   * no auto-centering, and no built-in padding. Use this when the host layout
   * already controls sizing. Defaults to `true`.
   */
  fitToContainer?: boolean;
}

export interface EsheetRendererEsheetProps extends EsheetRendererCommonProps {
  /** Form definition to render as an eSheet questionnaire. */
  representation?: 'esheet';
  /** Form definition — accepts FormDefinition, SurveyJS schema, MCP elicitation envelope,
   *  or any of the above as a JSON/YAML string. Auto-detected and converted internally.
   *  Set `strict` to disable auto-conversion and require a valid FormDefinition directly. */
  formDataInput: unknown;
  pdfSource?: never;
}

export interface EsheetRendererPdfProps extends EsheetRendererCommonProps {
  /** Renders an imported PDF page canvas and editable mapped answer controls. */
  representation: 'pdf';
  /** PDF bytes to import into the renderer's eSheet response store. */
  pdfSource: PdfSource;
  formDataInput?: never;
}

export type EsheetRendererProps =
  | EsheetRendererEsheetProps
  | EsheetRendererPdfProps;

// ---------------------------------------------------------------------------
// Response Format Options
// ---------------------------------------------------------------------------

/** Response format options for getResponse() */
export type ResponseFormat = 'native' | 'fhir';

/** Options for getResponse() */
export interface GetResponseOptions {
  /** Output format: 'native' (default) or 'fhir' (FHIR QuestionnaireResponse) */
  format?: ResponseFormat;
  /** FHIR export options (required when format is 'fhir') */
  fhir?: Omit<ResponseExportOptions, 'questionnaireUrl'> & {
    /** Canonical URL of the questionnaire. Falls back to form._sourceData metadata if available. */
    questionnaireUrl?: string;
  };
}

/** Return type for getResponse() — varies by format */
export type GetResponseResult<T extends ResponseFormat = 'native'> =
  T extends 'fhir' ? FhirQuestionnaireResponse : FormResponse;

export interface EsheetRendererHandle {
  /** Returns the current PDF with mapped response values when PDF rendering is active. */
  exportPdf: () => Promise<Uint8Array>;
  /** Get current form responses */
  getRawResponse: () => FormResponse;
  /**
   * Get form responses in the specified format.
   *
   * @param options - Format and export options
   * @returns Native FormResponse or FHIR QuestionnaireResponse
   *
   * @example
   * ```ts
   * // Native format (default)
   * const native = ref.current.getResponse();
   *
   * // FHIR QuestionnaireResponse
   * const fhir = ref.current.getResponse({
   *   format: 'fhir',
   *   fhir: {
   *     questionnaireUrl: 'http://example.org/Questionnaire/my-form',
   *     status: 'completed',
   *   }
   * });
   * ```
   */
  getResponse: <T extends ResponseFormat = 'native'>(
    options?: GetResponseOptions & { format?: T }
  ) => GetResponseResult<T>;
  /** Get form store instance */
  getFormStore: () => FormStore;
  /** Get UI store instance */
  getUIStore: () => UIStore;
  /** Get validated form responses (returns null if invalid) */
  getValidResponse: () => {
    response: FormResponse | null;
    errors: ValidationError[];
  };
  /** Returns true if touch mode is currently enabled */
  isTouchModeEnabled: () => boolean;
  /** Toggle touch mode on/off. Only works when touchMode prop is 'auto' or undefined. Overrides auto-detection. */
  setTouchMode: (enabled: boolean) => void;
  /** Reset to auto-detection mode (clears manual override). Only works when touchMode='auto'. */
  resetTouchMode: () => void;
}

/**
 * EsheetRenderer - Read-only questionnaire form renderer
 *
 * Renders a form in fill-out mode with conditional visibility logic.
 * Reuses all field components from @esheet/fields.
 *
 * @example
 * ```tsx
 * const rendererRef = useRef<EsheetRendererHandle>(null);
 *
 * <EsheetRenderer
 *   formData={myFormDefinition}
 *   initialResponses={{ field1: 'answer' }}
 *   ref={rendererRef}
 * />
 *
 * // Later: get responses
 * const responses = rendererRef.current?.getRawResponse();
 * ```
 */
export const EsheetRenderer = React.forwardRef<
  EsheetRendererHandle,
  EsheetRendererProps
>(function EsheetRenderer(props, ref) {
  ensureDefaultFieldComponentsRegistered();

  const formStore = React.useMemo(
    () => createFormStore(undefined, props.allowDangerousJS ?? false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const uiStore = React.useMemo(() => createUIStore(), []);

  React.useEffect(() => {
    if (props.onRendererToolsReady)
      props.onRendererToolsReady(createRendererTools(formStore));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formStore]);

  return (
    <FormStoreContext.Provider value={formStore}>
      <UIContext.Provider value={uiStore}>
        <EsheetRendererInner
          {...props}
          formStore={formStore}
          uiStore={uiStore}
          ref={ref}
        />
      </UIContext.Provider>
    </FormStoreContext.Provider>
  );
});

type EsheetRendererInnerProps = EsheetRendererProps & {
  formStore: FormStore;
  uiStore: UIStore;
};

interface RendererPdfSession {
  sourcePdf: Uint8Array;
  mappings: PdfFieldMapping[];
  sourceFieldNames: string[];
  warnings: PdfImportWarning[];
}

const EsheetRendererInner = React.forwardRef<
  EsheetRendererHandle,
  EsheetRendererInnerProps
>(function EsheetRendererInner(props, ref) {
  const {
    className = '',
    initialResponses,
    strict = false,
    onReady,
    onSubmit,
    submitLabel = 'Submit',
    formStore,
    uiStore,
    touchMode,
    onTouchModeChange,
    allowDangerousJS = false,
    collab,
    fitToContainer = true,
  } = props;
  const representation = props.representation ?? 'esheet';
  const formData =
    representation === 'esheet'
      ? props.formDataInput
      : { id: 'pdf-loading', pages: [] };
  const pdfSource = representation === 'pdf' ? props.pdfSource : undefined;
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [softBypassOpen, setSoftBypassOpen] = React.useState(false);
  const [pendingResponse, setPendingResponse] =
    React.useState<FormResponse | null>(null);
  const [pdfSession, setPdfSession] = React.useState<RendererPdfSession | null>(
    null
  );
  const [pdfImportError, setPdfImportError] = React.useState<string | null>(
    null
  );
  const onReadyRef = React.useRef(onReady);
  onReadyRef.current = onReady;

  const handleSubmitClick = () => {
    const state = formStore.getState();
    const errors = validateForm(
      state.normalized,
      state.responses,
      state.dangerouslyAllowJS
    );
    const hardErrors = errors.filter((e) => e.severity !== 'soft');
    if (hardErrors.length > 0) return; // hard errors — field-level UI handles display
    const softErrors = errors.filter((e) => e.severity === 'soft');
    if (softErrors.length > 0) {
      setPendingResponse(state.responses);
      setSoftBypassOpen(true);
    } else {
      onSubmit?.(state.responses);
    }
  };

  // Touch mode state using shared hook
  const {
    isTouchEnabled,
    isManualOverride,
    setTouchMode: setTouchModeInternal,
    resetTouchMode: resetTouchModeInternal,
  } = useTouchMode({ mode: touchMode, onChange: onTouchModeChange });

  // Initialize form definition and set preview mode
  useRendererInit(
    formStore,
    uiStore,
    formData,
    initialResponses,
    setValidationErrors,
    strict,
    representation === 'esheet' ? onReady : undefined,
    allowDangerousJS,
    representation === 'esheet'
  );

  React.useEffect(() => {
    if (representation !== 'pdf' || !pdfSource) {
      setPdfSession(null);
      setPdfImportError(null);
      return;
    }
    let cancelled = false;
    setPdfSession(null);
    setPdfImportError(null);

    void import('@esheet/pdf')
      .then(({ importPdf }) => importPdf(pdfSource))
      .then((result) => {
        if (cancelled) return;
        formStore
          .getState()
          .replaceDefinitionAndResponses(result.definition, result.responses);
        uiStore.getState().setMode('preview');
        for (const [fieldId, response] of Object.entries(
          initialResponses ?? {}
        )) {
          formStore.getState().setResponse(fieldId, response);
        }
        setPdfSession({
          sourcePdf: result.sourcePdf,
          mappings: result.mappings,
          sourceFieldNames: Array.from(
            new Set(result.mappings.map((mapping) => mapping.pdfFieldName))
          ),
          warnings: result.warnings,
        });
        onReadyRef.current?.();
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setPdfImportError(
          reason instanceof Error
            ? reason.message
            : 'The PDF could not be imported.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [formStore, initialResponses, pdfSource, representation]);

  const exportPdf = React.useCallback(async (): Promise<Uint8Array> => {
    const pdf = await import('@esheet/pdf');
    const definition = formStore.getState().hydrateDefinition();
    const responses = formStore.getState().responses;
    if (pdfSession) {
      const sourceFieldNames = new Set(pdfSession.sourceFieldNames);
      return pdf.applyPdfFieldLayout(
        pdfSession.sourcePdf,
        pdfSession.mappings,
        {
          addedFields: pdfSession.mappings.filter(
            (mapping) => !sourceFieldNames.has(mapping.pdfFieldName)
          ),
          definition,
          responses,
        }
      );
    }
    const generated = await pdf.generatePdf(definition, { responses });
    return pdf.applyPdfFieldLayout(
      generated.bytes,
      pdf.applyPdfPlacementOverrides(definition, generated.mappings),
      { responses }
    );
  }, [formStore, pdfSession]);

  // Expose ref API
  React.useImperativeHandle(
    ref,
    () => ({
      exportPdf,
      getRawResponse: () => formStore.getState().responses,
      getResponse: <T extends ResponseFormat = 'native'>(
        options?: GetResponseOptions & { format?: T }
      ): GetResponseResult<T> => {
        const state = formStore.getState();
        const responses = state.responses;

        if (options?.format === 'fhir') {
          // Build FHIR QuestionnaireResponse
          const normalizedAnswers = normalizeResponses(responses);

          // Try to get questionnaire URL from options or formSourceData
          const fhirMeta = state.formSourceData as FhirFormMeta | undefined;
          const questionnaireUrl =
            options.fhir?.questionnaireUrl ??
            fhirMeta?.url ??
            `urn:uuid:${state.formId}`;

          const exportOptions: ResponseExportOptions = {
            questionnaireUrl,
            status: options.fhir?.status ?? 'completed',
            subject: options.fhir?.subject,
            author: options.fhir?.author,
            resourceId: options.fhir?.resourceId,
          };

          // Rebuild form definition from normalized state
          const formDefinition = {
            id: state.formId,
            pages: hydrateDefinition(state.normalized),
            _sourceData: state.formSourceData,
          };

          return exportResponseToFhir(
            formDefinition,
            normalizedAnswers,
            exportOptions
          ) as GetResponseResult<T>;
        }

        // Native format (default)
        return responses as GetResponseResult<T>;
      },
      getFormStore: () => formStore,
      getUIStore: () => uiStore,
      getValidResponse: () => {
        const state = formStore.getState();
        const errors = validateForm(state.normalized, state.responses);
        return {
          response: errors.length === 0 ? state.responses : null,
          errors,
        };
      },
      isTouchModeEnabled: () => isTouchEnabled,
      setTouchMode: setTouchModeInternal,
      resetTouchMode: resetTouchModeInternal,
    }),
    [
      formStore,
      uiStore,
      exportPdf,
      isTouchEnabled,
      setTouchModeInternal,
      resetTouchModeInternal,
    ]
  );

  // Determine if touch mode class should be applied
  // true: always apply, 'auto'/undefined: apply based on isTouchEnabled state, false: never apply (CSS only)
  const applyTouchClass =
    touchMode === true ||
    ((touchMode === 'auto' || touchMode === undefined) && isTouchEnabled);

  // Apply disabled class when user explicitly disabled touch mode (prevents CSS media query)
  const applyDisabledClass = isManualOverride && !isTouchEnabled;

  const rootClasses = [
    'esheet-renderer-root',
    applyTouchClass && 'esheet-touch-active',
    applyDisabledClass && 'touch-mode-disabled',
    fitToContainer
      ? 'ms:w-full ms:text-mstext'
      : 'ms:w-full ms:max-w-2xl ms:mx-auto ms:p-4 ms:text-mstext',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses}>
      <ZodIssuesPanel issues={validationErrors} />
      {representation === 'pdf' ? (
        pdfImportError ? (
          <div role="alert">{pdfImportError}</div>
        ) : pdfSession ? (
          <RendererPdfView
            sourcePdf={pdfSession.sourcePdf}
            mappings={pdfSession.mappings}
            form={formStore}
          />
        ) : (
          <div role="status">Loading PDF...</div>
        )
      ) : (
        <RendererBody form={formStore} ui={uiStore} collab={collab} />
      )}
      {onSubmit && (
        <div className="renderer-submit ms:mt-6 ms:flex ms:justify-end">
          <button
            type="button"
            onClick={handleSubmitClick}
            className="ms:px-6 ms:py-2 ms:rounded-lg ms:bg-msprimary ms:text-mstextsecondary ms:text-sm ms:font-medium ms:hover:bg-msprimary/90 ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer"
          >
            {submitLabel}
          </button>
        </div>
      )}
      <FeedbackModal
        open={softBypassOpen}
        variant="warning"
        title="Recommended fields unanswered"
        message="Some recommended fields are unanswered. You can still submit, or go back to fill them in."
        confirmLabel="Submit anyway"
        cancelLabel="Go back"
        showCancel
        onConfirm={() => {
          setSoftBypassOpen(false);
          if (pendingResponse) onSubmit?.(pendingResponse);
          setPendingResponse(null);
        }}
        onClose={() => {
          setSoftBypassOpen(false);
          setPendingResponse(null);
        }}
      />
    </div>
  );
});
