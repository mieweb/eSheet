import React from 'react';
import type { FormStore, UIStore, FieldResponseMap } from '@esheet/core';

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

// ---------------------------------------------------------------------------
// Action handler context (for `action` fields, e.g. a "Close Case" button)
// ---------------------------------------------------------------------------

/** Payload dispatched when an `action` field's button is clicked. */
export interface ActionEvent {
  /** The action field's `actionId` (falls back to the field `id`). */
  actionId: string;
  /** The action field's `id`. */
  fieldId: string;
  /** Snapshot of the current form responses at click time. */
  responses: FieldResponseMap;
}

/** Host-provided callback invoked when an action field is triggered. */
export type ActionHandler = (event: ActionEvent) => void;

export const ActionContext = React.createContext<ActionHandler | null>(null);

/** Hook to access the host's action handler, or `null` when none is provided. */
export function useActionHandler(): ActionHandler | null {
  return React.useContext(ActionContext);
}
