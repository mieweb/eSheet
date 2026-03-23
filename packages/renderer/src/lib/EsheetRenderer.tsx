import React from 'react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormResponse,
  type FormStore,
  type UIStore,
} from '@esheet/core';
import { FormStoreContext, UIContext } from '@esheet/fields';
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
  getResponse: () => FormResponse;
  /** Get form store instance */
  getFormStore: () => FormStore;
  /** Get UI store instance */
  getUIStore: () => UIStore;
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
 * const responses = rendererRef.current?.getResponse();
 * ```
 */
export const EsheetRenderer = React.forwardRef<
  EsheetRendererHandle,
  EsheetRendererProps
>(function EsheetRenderer(props, ref) {
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
      getResponse: () => formStore.getState().responses,
      getFormStore: () => formStore,
      getUIStore: () => uiStore,
    }),
    [formStore, uiStore]
  );

  const rootClasses = [
    'esheet-renderer-root',
    'es:w-full es:max-w-2xl es:mx-auto es:p-4 es:bg-esbackground es:text-estext',
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
