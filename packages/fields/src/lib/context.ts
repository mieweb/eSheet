import React from 'react';
import type { FormStore, UIStore, LabelVariant } from '@esheet/core';

export const FormStoreContext = React.createContext<FormStore | null>(null);
export const UIContext = React.createContext<UIStore | null>(null);

/** Hook to access the FormStore from context. */
export function useFormStore(): FormStore {
  const ctx = React.useContext(FormStoreContext);
  if (!ctx) throw new Error('useFormStore must be used inside a form provider');
  return ctx;
}

/**
 * Resolve the effective label variant for a field:
 * field override → form-level default → 'stacked'.
 * Subscribes to the form store so form-level changes re-render the field.
 */
export function useLabelVariant(
  form: FormStore,
  definition: { labelVariant?: LabelVariant }
): LabelVariant {
  const formLabelVariant = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().formLabelVariant
  );
  return definition.labelVariant ?? formLabelVariant ?? 'stacked';
}

/** Hook to access the UIStore from context. */
export function useUI(): UIStore {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside a UI provider');
  return ctx;
}
