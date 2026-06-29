import React from 'react';
import type { FieldComponentProps, ActionFieldDefinition } from '@esheet/core';
import { useActionHandler } from '../../lib/context.js';

// Visual emphasis → button classes. Unknown variants fall back to the default.
const VARIANT_CLASSES: Record<string, string> = {
  primary: 'ms:bg-msprimary ms:text-mstextsecondary ms:border-msprimary',
  danger: 'ms:bg-msdanger ms:text-mstextsecondary ms:border-msdanger',
  default: 'ms:bg-mssurface ms:text-mstext ms:border-msborder',
};

/**
 * ActionField — a button that triggers a host-defined side effect.
 *
 * Stores no response. On click it invokes the renderer's `onAction` callback
 * (via {@link useActionHandler}) with the field's `actionId` and a snapshot of
 * the current responses. Use it for actions like "Close Case" that mutate state
 * owned by the host application rather than the form.
 */
export const ActionField = React.memo(function ActionField({
  field,
  form,
  isEnabled,
}: FieldComponentProps) {
  const def = field.definition as ActionFieldDefinition;
  const onAction = useActionHandler();

  const handleClick = React.useCallback(() => {
    if (def.confirm && !window.confirm(def.confirm)) return;
    onAction?.({
      actionId: def.actionId ?? def.id,
      fieldId: def.id,
      responses: form.getState().responses,
    });
  }, [def.actionId, def.confirm, def.id, form, onAction]);

  const variantClass =
    VARIANT_CLASSES[def.variant ?? 'default'] ?? VARIANT_CLASSES.default;

  return (
    <button
      type="button"
      className={`action-field-button ms:inline-flex ms:items-center ms:justify-center ms:px-4 ms:py-2 ms:rounded ms:border ms:font-medium ms:transition-colors ms:disabled:opacity-50 ms:disabled:cursor-not-allowed ${variantClass}`}
      disabled={!isEnabled}
      onClick={handleClick}
    >
      {def.label ?? 'Action'}
    </button>
  );
});
