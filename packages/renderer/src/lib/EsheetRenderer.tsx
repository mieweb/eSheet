import React from 'react';
import {
  createFormStore,
  createUIStore,
  validateForm,
  type FormDefinition,
  type FormResponse,
  type FormStore,
  type UIStore,
  type ValidationError,
} from '@esheet/core';
import { FormStoreContext, UIContext } from '@esheet/fields';
import { ensureDefaultFieldComponentsRegistered } from './register-defaults.js';
import { useRendererInit } from './hooks/useRendererInit.js';
import { RendererBody } from './components/RendererBody.js';

export interface EsheetRendererProps {
  /** Form definition (JSON object, JSON string, or YAML string) */
  formData: FormDefinition | string;
  /** Additional CSS classes for root container */
  className?: string;
  /** Initial form responses (pre-fill data) */
  initialResponses?: FormResponse;
}

export interface EsheetRendererHandle {
  /** Get current form responses */
  getRawResponse: () => FormResponse;
  /** Get form store instance */
  getFormStore: () => FormStore;
  /** Get UI store instance */
  getUIStore: () => UIStore;
  /** Get validated form responses (returns null if invalid) */
  getValidResponse: () => {
    response: FormResponse | null;
    errors: ValidationError[];
  };
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

  const formStore = React.useMemo(() => createFormStore(), []);
  const uiStore = React.useMemo(() => createUIStore(), []);

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

interface EsheetRendererInnerProps extends EsheetRendererProps {
  formStore: FormStore;
  uiStore: UIStore;
}

const EsheetRendererInner = React.forwardRef<
  EsheetRendererHandle,
  EsheetRendererInnerProps
>(function EsheetRendererInner(
  { formData, className = '', initialResponses, formStore, uiStore },
  ref
) {
  // Initialize form definition and set preview mode
  useRendererInit(formStore, uiStore, formData, initialResponses);

  // Expose ref API
  React.useImperativeHandle(
    ref,
    () => ({
      getRawResponse: () => formStore.getState().responses,
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
    }),
    [formStore, uiStore]
  );

  const rootClasses = [
    'esheet-renderer-root',
    'ms:w-full ms:max-w-2xl ms:mx-auto ms:p-4 ms:bg-msbackground ms:text-mstext',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses}>
      <RendererBody form={formStore} ui={uiStore} />
    </div>
  );
});
