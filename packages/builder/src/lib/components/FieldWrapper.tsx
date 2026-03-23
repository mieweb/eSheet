import React, { useSyncExternalStore } from 'react';
import type {
  FieldDefinition,
  FieldResponse,
  FieldComponentProps,
  FormStore,
  UIStore,
} from '@esheet/core';
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
  /** Ref attached to the drag-handle element. */
  dragHandleRef?: React.RefObject<HTMLDivElement | null>;
  /** Optional override for selection state (used by nested section child interaction). */
  isSelectedOverride?: boolean;
  /** Optional override for click selection behavior. */
  onSelectOverride?: (e: React.MouseEvent) => void;
  /** Optional selected styling variant. */
  selectedVariant?: 'default' | 'nested';
  /** Optional signal used to force expand a field wrapper (used for section drop UX). */
  forceExpandVersion?: number;
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
  dragHandleRef,
  isSelectedOverride,
  onSelectOverride,
  selectedVariant = 'default',
  forceExpandVersion,
  children,
}: FieldWrapperProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const lastForceExpandVersionRef = React.useRef<number | undefined>(undefined);

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
  const isSelected =
    !isPreview && (isSelectedOverride ?? selectedFieldId === fieldId);

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

  React.useEffect(() => {
    if (!field) return;
    if (field.definition.fieldType !== 'section') return;
    if (forceExpandVersion === undefined) return;
    if (lastForceExpandVersionRef.current === forceExpandVersion) return;

    lastForceExpandVersionRef.current = forceExpandVersion;
    setIsExpanded((prev) => (prev ? prev : true));
  }, [field?.definition.fieldType, forceExpandVersion]);

  if (!field) {
    return null;
  }

  // In preview mode, hide fields whose visibility rules evaluate to false.
  if (isPreview && !isVisible) {
    return null;
  }

  // --- Preview mode: minimal chrome, no builder controls ---
  if (isPreview) {
    const isSection = field.definition.fieldType === 'section';
    const parentNode = field.parentId
      ? form.getState().getField(field.parentId)
      : null;
    const isChildOfSection = parentNode?.definition.fieldType === 'section';

    return (
      <div
        className={`field-wrapper es:bg-essurface${
          isSection ? ' es:mb-2 es:border es:border-esborder es:rounded' : ''
        }${
          !isSection && !isChildOfSection
            ? ' es:mb-2 es:p-6 es:border es:border-esborder es:rounded'
            : ''
        }${
          isChildOfSection
            ? ' es:p-6 es:border-b es:border-esborder es:last:border-b-0'
            : ''
        }${!isEnabled ? ' es:opacity-50 es:pointer-events-none' : ''}${
          isRequired && !isSection && !isChildOfSection
            ? ' es:border-l-2 es:border-l-esdanger'
            : ''
        }`}
        data-field-id={fieldId}
        data-field-type={field.definition.fieldType}
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
  const questionPreview = questionText
    ? questionText.length > 18
      ? `${questionText.slice(0, 18)}...`
      : questionText
    : 'Untitled';

  // While collapsed, keep the wrapper compact.
  const effectiveExpanded = isExpanded;

  // Base wrapper classes
  let wrapperClass = isSelected
    ? selectedVariant === 'nested'
      ? 'field-wrapper es:group es:relative es:mb-2 es:bg-essurface es:border-2 es:border-dashed es:border-esprimary es:rounded-lg es:transition-all es:outline-none'
      : 'field-wrapper es:group es:relative es:mb-2 es:bg-essurface es:border-2 es:border-esprimary es:rounded-lg es:transition-all es:outline-none'
    : 'field-wrapper es:group es:relative es:mb-2 es:bg-essurface es:border es:border-esborder es:rounded-lg es:transition-all es:hover:border-esprimary/30 es:outline-none';

  if (!effectiveExpanded) {
    wrapperClass += ' es:p-0';
  } else {
    wrapperClass += ' es:p-6';
  }

  // Header padding/margin adjustments
  const headerClass = effectiveExpanded
    ? 'field-wrapper-edit-header es:flex es:justify-between es:items-center es:gap-3 es:px-3 es:py-2.5 es:-mx-6 es:-mt-6 es:mb-4 es:bg-esbackgroundsecondary es:border-b es:border-esborder es:rounded-t-lg'
    : 'field-wrapper-edit-header es:flex es:justify-between es:items-center es:gap-3 es:px-3 es:py-2.5 es:m-0 es:bg-esbackgroundsecondary es:border-b es:border-esborder es:rounded-lg';

  return (
    <div
      className={wrapperClass}
      onClick={handleSelect}
      data-field-id={fieldId}
      data-field-type={field.definition.fieldType}
      data-selected={isSelected ? 'true' : 'false'}
      aria-selected={isSelected || undefined}
      tabIndex={-1}
    >
      {/* Collapsible Header */}
      <div className={headerClass}>
        {/* Drag handle */}
        {dragHandleRef !== undefined && (
          <div
            ref={dragHandleRef}
            className="drag-handle es:flex es:items-center es:p-1 es:text-estextmuted es:cursor-grab es:active:cursor-grabbing es:shrink-0"
            style={{ touchAction: 'none' }}
            aria-label="Drag to reorder"
          >
            <DragHandleIcon className="es:w-4 es:h-4" />
          </div>
        )}
        <div className="es:flex-1 es:flex es:items-center es:gap-1.5 es:min-w-0 es:select-none">
          {/* Type chip — tinted primary bg, same as before */}
          <span className="fieldtype-chip es:inline-block es:shrink-0 es:text-xs es:font-medium es:text-esprimary es:bg-esprimary/10 es:px-2 es:py-0.5 es:rounded">
            {field.definition.fieldType}
          </span>
          {/* ID chip — explicit label for quick scanning */}
          <span className="id-chip es:inline-flex es:items-center es:gap-1 es:shrink-0 es:text-xs es:font-mono es:text-essecondary es:bg-essecondary/10 es:px-2 es:py-0.5 es:rounded">
            <span className="es:opacity-70">id:</span>
            <span className="es:font-semibold">{field.definition.id}</span>
          </span>
          {/* Question — plain muted text */}
          <span className="question-label es:text-xs es:text-estextmuted es:truncate es:min-w-0">
            {questionPreview}
          </span>
          {field.definition.required && (
            <span
              className="required-indicator es:text-esdanger es:text-xs es:font-bold es:shrink-0"
              aria-label="Required"
            >
              *
            </span>
          )}
        </div>

        {/* Actions: Edit (mobile), Toggle (expand/collapse), Delete */}
        <div className="field-wrapper-actions es:flex es:items-center es:gap-1 es:shrink-0">
          {/* Edit button (mobile only) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectOverride) {
                onSelectOverride(e);
              } else {
                ui.getState().selectField(fieldId);
              }
              ui.getState().setEditModalOpen(true);
            }}
            className="field-edit-btn es:block es:lg:hidden es:p-1.5 es:bg-transparent es:text-estextmuted es:hover:bg-esbackgroundhover es:rounded es:transition-colors es:border-0 es:outline-none es:focus:outline-none"
            title="Edit"
            aria-label="Edit field"
          >
            <EditIcon className="es:h-5 es:w-5 es:text-estextmuted" />
          </button>

          {/* Toggle expand/collapse */}
          <button
            type="button"
            onClick={handleToggleExpand}
            aria-expanded={effectiveExpanded}
            aria-controls={`${instanceId}-fw-body-${fieldId}`}
            title={effectiveExpanded ? 'Collapse' : 'Expand'}
            aria-label={effectiveExpanded ? 'Collapse field' : 'Expand field'}
            className="field-collapse-btn es:p-1.5 es:bg-transparent es:text-estextmuted es:hover:bg-esbackgroundhover es:rounded es:transition-colors es:border-0 es:outline-none es:focus:outline-none"
          >
            {effectiveExpanded ? (
              <ViewSmallIcon className="es:collapse-icon es:h-5 es:w-5 es:text-estextmuted" />
            ) : (
              <ViewBigIcon className="es:collapse-icon es:h-5 es:w-5 es:text-estextmuted" />
            )}
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="field-delete-btn es:p-1.5 es:bg-transparent es:text-estextmuted es:hover:bg-esdanger/10 es:hover:text-esdanger es:rounded es:transition-colors es:border-0 es:outline-none es:focus:outline-none"
            title="Delete"
            aria-label="Delete field"
          >
            <TrashIcon className="es:h-5 es:w-5" />
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
