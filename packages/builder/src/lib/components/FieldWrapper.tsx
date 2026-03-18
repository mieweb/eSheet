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
        className={`field-wrapper ms:bg-mssurface${
          isSection ? ' ms:mb-2 ms:border ms:border-msborder ms:rounded' : ''
        }${
          !isSection && !isChildOfSection
            ? ' ms:mb-2 ms:p-6 ms:border ms:border-msborder ms:rounded'
            : ''
        }${
          isChildOfSection
            ? ' ms:p-6 ms:border-b ms:border-msborder ms:last:border-b-0'
            : ''
        }${!isEnabled ? ' ms:opacity-50 ms:pointer-events-none' : ''}${
          isRequired && !isSection && !isChildOfSection
            ? ' ms:border-l-2 ms:border-l-msdanger'
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
      ? 'field-wrapper ms:group ms:relative ms:mb-2 ms:bg-mssurface ms:border-2 ms:border-dashed ms:border-msprimary ms:rounded-lg ms:transition-all ms:outline-none'
      : 'field-wrapper ms:group ms:relative ms:mb-2 ms:bg-mssurface ms:border-2 ms:border-msprimary ms:rounded-lg ms:transition-all ms:outline-none'
    : 'field-wrapper ms:group ms:relative ms:mb-2 ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:transition-all ms:hover:border-msprimary/30 ms:outline-none';

  if (!effectiveExpanded) {
    wrapperClass += ' ms:p-0';
  } else {
    wrapperClass += ' ms:p-6';
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
            className="drag-handle ms:flex ms:items-center ms:p-1 ms:text-mstextmuted ms:cursor-grab ms:active:cursor-grabbing ms:shrink-0"
            style={{ touchAction: 'none' }}
            aria-label="Drag to reorder"
          >
            <DragHandleIcon className="ms:w-4 ms:h-4" />
          </div>
        )}
        <div className="ms:flex-1 ms:flex ms:items-center ms:gap-1.5 ms:min-w-0 ms:select-none">
          {/* Type chip — tinted primary bg, same as before */}
          <span className="fieldtype-chip ms:inline-block ms:shrink-0 ms:text-xs ms:font-medium ms:text-msprimary ms:bg-msprimary/10 ms:px-2 ms:py-0.5 ms:rounded">
            {field.definition.fieldType}
          </span>
          {/* ID chip — explicit label for quick scanning */}
          <span className="id-chip ms:inline-flex ms:items-center ms:gap-1 ms:shrink-0 ms:text-xs ms:font-mono ms:text-mssecondary ms:bg-mssecondary/10 ms:px-2 ms:py-0.5 ms:rounded">
            <span className="ms:opacity-70">id:</span>
            <span className="ms:font-semibold">{field.definition.id}</span>
          </span>
          {/* Question — plain muted text */}
          <span className="question-label ms:text-xs ms:text-mstextmuted ms:truncate ms:min-w-0">
            {questionPreview}
          </span>
          {field.definition.required && (
            <span
              className="required-indicator ms:text-msdanger ms:text-xs ms:font-bold ms:shrink-0"
              aria-label="Required"
            >
              *
            </span>
          )}
        </div>

        {/* Actions: Edit (mobile), Toggle (expand/collapse), Delete */}
        <div className="field-wrapper-actions ms:flex ms:items-center ms:gap-1 ms:shrink-0">
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
