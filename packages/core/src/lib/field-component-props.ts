// ---------------------------------------------------------------------------
// FieldComponentProps — the contract between field components and the host
// (builder / renderer). Lives in core so field packages only depend on core.
// ---------------------------------------------------------------------------

import type { FieldDefinition, FieldResponse } from './types.js';
import type { FieldNode } from './functions/normalize.js';
import type { FormStore } from './stores/form-store.js';
import type { UIStore } from './stores/ui-store.js';

/**
 * Props passed to every field component by the host wrapper (FieldWrapper in
 * builder, or a future renderer wrapper). This is the **extensibility API**
 * that third-party / plugin field components code against.
 */
export interface FieldComponentProps {
  /** The field node (definition + tree metadata). */
  field: FieldNode;
  /** The form store instance (read state, subscribe, dispatch). */
  form: FormStore;
  /** The UI store instance (selection, mode, etc.). */
  ui: UIStore;
  /** Whether this field is currently selected in the builder. */
  isSelected: boolean;
  /** Whether the host is in preview / render mode (read-only chrome). */
  isPreview: boolean;
  /** Current response data for this field (`undefined` if none yet). */
  response: FieldResponse | undefined;
  /** Remove this field from the form. */
  onRemove: () => void;
  /** Patch this field's definition (shallow merge). */
  onUpdate: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => void;
  /** Set this field's response value. */
  onResponse: (response: FieldResponse) => void;
}
