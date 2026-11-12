// ---------------------------------------------------------------------------
// FieldComponentProps — the contract between field components and the host
// (builder / renderer). Lives in core so field packages only depend on core.
// ---------------------------------------------------------------------------

import type { FieldResponse } from './types.js';
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
  /** Computed conditional enabled state (`true` when no rules override). */
  isEnabled: boolean;
  /** Computed conditional required state — true only for hard-required fields. */
  isRequired: boolean;
  /** Computed soft-required state (warns but allows bypass). */
  isSoftRequired: boolean;
  /** Computed read-only state (static `readOnly` OR conditional rules). */
  isReadOnly: boolean;
  /** Current response data for this field (`undefined` if none yet). */
  response: FieldResponse | undefined;
  /** Computed value from setValue effects (if applicable). */
  computedValue?: string | number | null;
  /** Remove this field from the form. */
  onRemove: () => void;
  /** Patch this field's definition (shallow merge). */
  onUpdate: (patch: Record<string, unknown>) => void;
  /** Set this field's response value. */
  onResponse: (response: FieldResponse) => void;
}

export function getFieldForRender(
  field: FieldNode,
  form: FormStore,
  isPreview: boolean
): FieldNode {
  const definition = field.definition;

  if (
    !isPreview ||
    !('options' in definition) ||
    !Array.isArray(definition.options)
  ) {
    return field;
  }

  return {
    ...field,
    definition: {
      ...definition,
      options: form.getState().getVisibleOptions(definition.id),
    },
  };
}

// ---------------------------------------------------------------------------
// CollabDecorations — optional, host-supplied collaboration decorations
// (presence + change proposals) that the renderer displays per field. eSheet
// stays transport-agnostic: the host owns the collaboration machinery and
// hands the renderer plain data plus callbacks.
// ---------------------------------------------------------------------------

/** A collaborator currently focused on a field. */
export interface FieldPresence {
  name: string;
  color: string;
}

/** A pending change proposal targeting one field. */
export interface FieldProposal {
  id: string;
  proposedValue: unknown;
  baseValue?: unknown;
  actor: string;
  status: string;
  /** Present when the canonical value changed after the proposal was made. */
  conflict?: { currentValue: unknown };
}

/** Host-supplied decorations rendered by `EsheetRenderer` (all optional). */
export interface CollabDecorations {
  /** Collaborators focused per field id — rendered as colored presence dots. */
  presenceByField?: Record<string, FieldPresence[]>;
  /** Open proposals per field id — rendered as an adornment under the field. */
  proposalsByField?: Record<string, FieldProposal[]>;
  /** When true, Accept / Reject buttons are shown on proposal adornments. */
  canResolve?: boolean;
  /** Called when the user resolves a proposal from an adornment. */
  onProposalAction?: (
    fieldId: string,
    proposalId: string,
    action: 'accept' | 'accept-anyway' | 'reject'
  ) => void;
  /** Renders proposed/current values for display. Defaults to `String(value)`. */
  formatValue?: (value: unknown) => string;
}
