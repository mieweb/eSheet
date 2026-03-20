import React from 'react';
import type { FormStore, UIStore } from '@msheet/core';

export const FormStoreContext = React.createContext<FormStore | null>(null);
export const UIContext = React.createContext<UIStore | null>(null);

/** Hook to access the FormStore from context. */
export function useFormStore(): FormStore {
  const ctx = React.useContext(FormStoreContext);
  if (!ctx) throw new Error('useFormStore must be used inside a form provider');
  return ctx;
}

/** Hook to access the UIStore from context. */
export function useUI(): UIStore {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside a UI provider');
  return ctx;
}
