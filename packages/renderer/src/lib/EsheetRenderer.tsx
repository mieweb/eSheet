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
  FieldProviderStack,
  UIContext,
  ZodIssuesPanel,
  FeedbackModal,
  useTouchMode,
  type FieldProvider,
} from '@esheet/fields';
import { ensureDefaultFieldComponentsRegistered } from './register-defaults.js';
import { useRendererInit } from './hooks/useRendererInit.js';
import {
  RendererBody,
  type RendererPageNavigation,
} from './components/RendererBody.js';

export interface EsheetRendererProps {
  /** Form definition — accepts FormDefinition, SurveyJS schema, MCP elicitation envelope,
   *  or any of the above as a YAML/JSON string. Auto-detected and converted internally.
   *  YAML is canonical for committed layouts; JSON is intended for wire/API payloads.
   *  Set `strict` to disable auto-conversion and require a valid FormDefinition directly. */
  formDataInput: unknown;
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
   * - `false`: Never enable touch mode (also disables the CSS media query)
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
  /** Show page tabs above the active page when rendering multiple pages. */
  topNavigation?: boolean;
  /** Show Previous / Next controls below the active page. */
  bottomNavigation?: boolean;
  /** Block forward page navigation while required fields on the current page are unanswered. */
  validateNavigation?: boolean;
  /** Page shown first, by id (issue #147). Unknown or absent → the first page. */
  initialPageId?: string;
  /**
   * Fires when the user changes pages (tab click, prev/next) — never on the
   * initial seed and never for programmatic `setCurrentPage`/`goToPage`, so a
   * host syncing the URL cannot loop (issue #147).
   */
  onPageChange?: (pageId: string, pageIndex: number) => void;
  /** Optional wrappers supplied by field add-ons. */
  fieldProviders?: readonly FieldProvider[];
  /**
   * Identity of the current user. When provided, activity entries are stamped
   * with `identity.name`. Absent → entries save unstamped.
   */
  identity?: { name: string };
}

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
  /** Show the page with this id. Returns `false` when the form has no such page. */
  goToPage: (pageId: string) => boolean;
  /** The active page's id, or `null` before any pages exist (issue #147). */
  getCurrentPageId: () => string | null;
  /**
   * Show a page by id or index. Unknown values are a silent no-op, and
   * programmatic moves never fire `onPageChange` (issue #147).
   */
  setCurrentPage: (pageIdOrIndex: string | number) => void;
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
        <FieldProviderStack providers={props.fieldProviders}>
          <EsheetRendererInner
            {...props}
            formStore={formStore}
            uiStore={uiStore}
            ref={ref}
          />
        </FieldProviderStack>
      </UIContext.Provider>
    </FormStoreContext.Provider>
  );
});

interface EsheetRendererInnerProps
  extends Omit<EsheetRendererProps, 'onRendererToolsReady'> {
  formStore: FormStore;
  uiStore: UIStore;
}

const EsheetRendererInner = React.forwardRef<
  EsheetRendererHandle,
  EsheetRendererInnerProps
>(function EsheetRendererInner(
  {
    formDataInput: formData,
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
    topNavigation = false,
    bottomNavigation = true,
    validateNavigation = true,
    initialPageId,
    onPageChange,
    identity,
  },
  ref
) {
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [softBypassOpen, setSoftBypassOpen] = React.useState(false);
  const [pendingResponse, setPendingResponse] =
    React.useState<FormResponse | null>(null);

  // Keep the host-supplied identity in the form store for activity authorship.
  React.useEffect(() => {
    formStore.getState().setIdentity(identity);
  }, [formStore, identity]);

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
    onReady,
    allowDangerousJS
  );

  // Expose ref API
  const goToPageRef = React.useRef<((pageId: string) => boolean) | null>(null);
  const registerGoToPage = React.useCallback(
    (goToPage: (pageId: string) => boolean) => {
      goToPageRef.current = goToPage;
    },
    []
  );
  const pageNavigationRef = React.useRef<RendererPageNavigation | null>(null);
  const registerPageNavigation = React.useCallback(
    (api: RendererPageNavigation) => {
      pageNavigationRef.current = api;
    },
    []
  );

  React.useImperativeHandle(
    ref,
    () => ({
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
      goToPage: (pageId: string) => goToPageRef.current?.(pageId) ?? false,
      getCurrentPageId: () =>
        pageNavigationRef.current?.getCurrentPageId() ?? null,
      setCurrentPage: (pageIdOrIndex: string | number) =>
        pageNavigationRef.current?.setCurrentPage(pageIdOrIndex),
    }),
    [
      formStore,
      uiStore,
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

  // Apply disabled class when touch mode is explicitly off — via prop or
  // manual toggle — so touch-mode.css's own media query stands down too.
  const applyDisabledClass =
    touchMode === false || (isManualOverride && !isTouchEnabled);

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
      <RendererBody
        form={formStore}
        ui={uiStore}
        collab={collab}
        topNavigation={topNavigation}
        bottomNavigation={bottomNavigation}
        validateNavigation={validateNavigation}
        registerGoToPage={registerGoToPage}
        initialPageId={initialPageId}
        onPageChange={onPageChange}
        registerPageNavigation={registerPageNavigation}
      />
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
