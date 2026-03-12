import React, { useSyncExternalStore } from 'react';
import type {
  FieldDefinition,
  FieldResponse,
  FieldComponentProps,
  FormStore,
  UIStore,
} from '@msheet/core';
import { useSelectedFieldId } from '../hooks/useSelectedFieldId.js';
import {
  TrashIcon,
  ViewBigIcon,
  ViewSmallIcon,
  EditIcon,
  DragHandleIcon,
} from '../icons.js';

/**
 * Props exposed to the render function for custom field components.
 * Identical to `FieldComponentProps` from core — kept as a named alias for
 * backward-compatibility with existing builder consumers.
 */
export type FieldWrapperRenderProps = FieldComponentProps;

export interface FieldWrapperProps {
  /** The field ID */
  fieldId: string;
  /** The form store */
  form: FormStore;
  /** The UI store */
  ui: UIStore;
  /** Drag handle attributes from @dnd-kit (optional) */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  /** Drag listeners from @dnd-kit (optional) */
  dragListeners?: Record<string, Function>;
  /** Whether the field is being dragged */
  isDragging?: boolean;
  /** Whether any drag operation is active in the canvas. */
  collapseWhileDragging?: boolean;
  /** Optional override for selection state (used by nested section child interaction). */
  isSelectedOverride?: boolean;
  /** Optional override for click selection behavior. */
  onSelectOverride?: (e: React.MouseEvent) => void;
  /** Optional selected styling variant. */
  selectedVariant?: 'default' | 'nested';
  /** Render function that receives field data and tools */
  children: (props: FieldWrapperRenderProps) => React.ReactNode;
}

/**
 * FieldWrapper - Extensibility API for custom field components.
 *
 * Wraps a field with collapsible header, selection highlighting, edit/delete buttons, and drag handles.
 * Exposes field data and tools to the render function, allowing users to create
 * custom field types while getting all the built-in editor functionality.
 *
 * @example
 * ```tsx
 * <FieldWrapper fieldId={id} form={form} ui={ui}>
 *   {({ field, onUpdate, onRemove }) => (
 *     <div>
 *       <input
 *         value={field.question}
 *         onChange={(e) => onUpdate({ question: e.target.value })}
 *       />
 *     </div>
 *   )}
 * </FieldWrapper>
 * ```
 */
export function FieldWrapper({
  fieldId,
  form,
  ui,
  dragHandleProps,
  dragListeners,
  isDragging = false,
  collapseWhileDragging = false,
  isSelectedOverride,
  onSelectOverride,
  selectedVariant = 'default',
  children,
}: FieldWrapperProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const field = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().getField(fieldId),
    () => form.getState().getField(fieldId)
  );
  const response = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().getResponse(fieldId),
    () => form.getState().getResponse(fieldId)
  );
  const mode = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().mode,
    () => ui.getState().mode
  );
  // Conditional states — subscribe so we re-render when other field responses
  // change (which may flip this field's visibility / enabled / required state).
  const isVisible = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().isVisible(fieldId),
    () => true
  );
  const isEnabled = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().isEnabled(fieldId),
    () => true
  );
  const isRequired = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().isRequired(fieldId),
    () => false
  );
  const instanceId = form.getState().instanceId;
  const selectedFieldId = useSelectedFieldId(ui);
  const isPreview = mode === 'preview';
  const isSelected = !isPreview && (isSelectedOverride ?? selectedFieldId === fieldId);

  // Handlers
  const handleSelect = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onSelectOverride) {
        onSelectOverride(e);
        return;
      }
      ui.getState().selectField(fieldId);
    },
    [ui, fieldId, onSelectOverride]
  );

  const handleRemove = React.useCallback(() => {
    form.getState().removeField(fieldId);
  }, [form, fieldId]);

  const handleUpdate = React.useCallback(
    (patch: Partial<Omit<FieldDefinition, 'fields'>>) => {
      form.getState().updateField(fieldId, patch);
    },
    [form, fieldId]
  );

  const handleResponse = React.useCallback(
    (resp: FieldResponse) => {
      form.getState().setResponse(fieldId, resp);
    },
    [form, fieldId]
  );

  const handleToggleExpand = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isSelected) {
        handleSelect(e);
      }
      setIsExpanded((prev) => !prev);
    },
    [isSelected, handleSelect]
  );

  if (!field) {
    return null;
  }

  // In preview mode, hide fields whose visibility rules evaluate to false.
  if (isPreview && !isVisible) {
    return null;
  }

  // --- Preview mode: minimal chrome, no builder controls ---
  if (isPreview) {
    return (
      <div
        className={`field-wrapper ms:mb-2 ms:p-6 ms:bg-mssurface ms:border ms:border-msborder ms:rounded${
          !isEnabled ? ' ms:opacity-50 ms:pointer-events-none' : ''
        }${isRequired ? ' ms:border-l-2 ms:border-l-msdanger' : ''}`}
        data-field-id={fieldId}
        aria-disabled={!isEnabled || undefined}
      >
        {children({
          field,
          form,
          ui,
          isSelected: false,
          isPreview: true,
          isEnabled,
          isRequired,
          response,
          onRemove: handleRemove,
          onUpdate: handleUpdate,
          onResponse: handleResponse,
        })}
      </div>
    );
  }

  // --- Build/Code mode: collapsible with full editor chrome ---
  const questionText =
    field.definition.fieldType === 'section'
      ? field.definition.title || ''
      : field.definition.question || '';

  // Collapse while dragging; restore prior state when drag ends
  const effectiveExpanded = isExpanded && !collapseWhileDragging;

  // Base wrapper classes
  let wrapperClass = isSelected
    ? selectedVariant === 'nested'
      ? 'field-wrapper ms:group ms:relative ms:mb-2 ms:bg-mssurface ms:border-2 ms:border-dashed ms:border-msprimary ms:rounded-lg ms:transition-all ms:outline-none'
      : 'field-wrapper ms:group ms:relative ms:mb-2 ms:bg-mssurface ms:border-2 ms:border-msprimary ms:rounded-lg ms:transition-all ms:outline-none'
    : 'field-wrapper ms:group ms:relative ms:mb-2 ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:transition-all ms:hover:border-msprimary/30 ms:outline-none';

  if (!effectiveExpanded) {
    wrapperClass += ' ms:p-0';
  } else {
    wrapperClass += ' ms:p-6';
  }

  if (isDragging) {
    wrapperClass += ' ms:opacity-50';
  }

  // Header padding/margin adjustments
  const headerClass = effectiveExpanded
    ? 'field-wrapper-edit-header ms:flex ms:justify-between ms:items-center ms:gap-3 ms:px-3 ms:py-2.5 ms:-mx-6 ms:-mt-6 ms:mb-4 ms:bg-msbackgroundsecondary ms:border-b ms:border-msborder ms:rounded-t-lg'
    : 'field-wrapper-edit-header ms:flex ms:justify-between ms:items-center ms:gap-3 ms:px-3 ms:py-2.5 ms:m-0 ms:bg-msbackgroundsecondary ms:border-b ms:border-msborder ms:rounded-lg';

  return (
    <div
      className={wrapperClass}
      onClick={handleSelect}
      data-field-id={fieldId}
      data-selected={isSelected ? 'true' : 'false'}
      aria-selected={isSelected || undefined}
      tabIndex={-1}
    >
      {/* Collapsible Header */}
      <div className={headerClass}>
        {/* Drag handle */}
        {(dragHandleProps || dragListeners) && (
          <div
            {...dragHandleProps}
            {...(dragListeners as React.HTMLAttributes<HTMLDivElement>)}
            className="drag-handle ms:flex ms:items-center ms:p-1 ms:text-mstextmuted ms:cursor-grab ms:active:cursor-grabbing ms:shrink-0"
            style={{ touchAction: 'none' }}
            aria-label="Drag to reorder"
          >
            <DragHandleIcon className="ms:w-4 ms:h-4" />
          </div>
        )}
        <div className="ms:text-left ms:flex-1 ms:select-none ms:text-sm ms:text-mstext ms:truncate ms:flex ms:items-center ms:gap-2">
          <span className="ms:inline-block ms:text-xs ms:font-medium ms:text-msprimary ms:bg-msprimary/10 ms:px-2 ms:py-0.5 ms:rounded ms:shrink-0">
            {field.definition.fieldType}
          </span>
          <span className="ms:truncate">{questionText}</span>
          {field.definition.required && (
            <span
              className="required-indicator ms:text-msdanger ms:text-sm ms:font-bold ms:shrink-0"
              aria-label="Required"
            >
              *
            </span>
          )}
        </div>

        {/* Actions: Edit (mobile), Toggle (expand/collapse), Delete */}
        <div className="field-wrapper-actions ms:flex ms:items-center ms:gap-1 ms:shrink-0">
          {/* Edit button (mobile only) - placeholder for future edit panel integration */}
          <button
            type="button"
            onClick={handleSelect}
            className="field-edit-btn ms:block ms:lg:hidden ms:p-1.5 ms:bg-transparent ms:text-mstextmuted ms:hover:bg-msbackgroundhover ms:rounded ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none"
            title="Edit"
            aria-label="Edit field"
          >
            <EditIcon className="ms:h-5 ms:w-5 ms:text-mstextmuted" />
          </button>

          {/* Toggle expand/collapse */}
          <button
            type="button"
            onClick={handleToggleExpand}
            aria-expanded={effectiveExpanded}
            aria-controls={`${instanceId}-fw-body-${fieldId}`}
            title={effectiveExpanded ? 'Collapse' : 'Expand'}
            aria-label={effectiveExpanded ? 'Collapse field' : 'Expand field'}
            className="field-collapse-btn ms:p-1.5 ms:bg-transparent ms:text-mstextmuted ms:hover:bg-msbackgroundhover ms:rounded ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none"
          >
            {effectiveExpanded ? (
              <ViewSmallIcon className="ms:collapse-icon ms:h-5 ms:w-5 ms:text-mstextmuted" />
            ) : (
              <ViewBigIcon className="ms:collapse-icon ms:h-5 ms:w-5 ms:text-mstextmuted" />
            )}
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="field-delete-btn ms:p-1.5 ms:bg-transparent ms:text-mstextmuted ms:hover:bg-msdanger/10 ms:hover:text-msdanger ms:rounded ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none"
            title="Delete"
            aria-label="Delete field"
          >
            <TrashIcon className="ms:h-5 ms:w-5" />
          </button>
        </div>
      </div>

      {/* Field Body (collapsible) */}
      {effectiveExpanded && (
        <div
          id={`${instanceId}-fw-body-${fieldId}`}
          className="field-wrapper-body"
        >
          {children({
            field,
            form,
            ui,
            isSelected,
            isPreview: false,
            isEnabled,
            isRequired,
            response,
            onRemove: handleRemove,
            onUpdate: handleUpdate,
            onResponse: handleResponse,
          })}
        </div>
      )}
    </div>
  );
}
