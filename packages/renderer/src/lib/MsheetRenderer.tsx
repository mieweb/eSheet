import React from 'react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormResponse,
  type FormStore,
  type UIStore,
} from '@msheet/core';
import { FormStoreContext, UIContext } from '@msheet/fields';
import { useRendererInit } from './hooks/useRendererInit.js';
import { RendererBody } from './components/RendererBody.js';

export interface MsheetRendererProps {
  /** Form definition (JSON object, JSON string, or YAML string) */
  formData: FormDefinition | string;
  /** Additional CSS classes for root container */
  className?: string;
  /** Initial form responses (pre-fill data) */
  initialResponses?: FormResponse;
}

export interface MsheetRendererHandle {
  /** Get current form responses */
  getResponse: () => FormResponse;
  /** Get form store instance */
  getFormStore: () => FormStore;
  /** Get UI store instance */
  getUIStore: () => UIStore;
}

/**
 * MsheetRenderer - Read-only questionnaire form renderer
 *
 * Renders a form in fill-out mode with conditional visibility logic.
 * Reuses all field components from @msheet/fields.
 *
 * @example
 * ```tsx
 * const rendererRef = useRef<MsheetRendererHandle>(null);
 *
 * <MsheetRenderer
 *   formData={myFormDefinition}
 *   initialResponses={{ field1: 'answer' }}
 *   ref={rendererRef}
 * />
 *
 * // Later: get responses
 * const responses = rendererRef.current?.getResponse();
 * ```
 */
export const MsheetRenderer = React.forwardRef<MsheetRendererHandle, MsheetRendererProps>(
  function MsheetRenderer(props, ref) {
    const formStore = React.useMemo(() => createFormStore(), []);
    const uiStore = React.useMemo(() => createUIStore(), []);

    return (
      <FormStoreContext.Provider value={formStore}>
        <UIContext.Provider value={uiStore}>
          <MsheetRendererInner {...props} formStore={formStore} uiStore={uiStore} ref={ref} />
        </UIContext.Provider>
      </FormStoreContext.Provider>
    );
  }
);

interface MsheetRendererInnerProps extends MsheetRendererProps {
  formStore: FormStore;
  uiStore: UIStore;
}

const MsheetRendererInner = React.forwardRef<MsheetRendererHandle, MsheetRendererInnerProps>(
  function MsheetRendererInner({ formData, className = '', initialResponses, formStore, uiStore }, ref) {
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
      'msheet-renderer-root',
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
  }
);
