import React from 'react';
import type { FieldDefinition, FieldNode } from '@msheet/core';
import type { FormEngine } from '@msheet/core';
import type { UIStore } from '../ui-store.js';
import { useSelectedFieldId } from '../hooks/useSelectedFieldId.js';

/**
 * Props exposed to the render function for custom field components.
 * This is the extensibility API that allows users to create custom fields.
 */
export interface FieldWrapperRenderProps {
  /** The field node (contains definition + metadata) */
  field: FieldNode;
  /** The form engine instance */
  engine: FormEngine;
  /** The UI store instance */
  ui: UIStore;
  /** Whether this field is currently selected */
  isSelected: boolean;
  /** Callback to remove this field */
  onRemove: () => void;
  /** Callback to update this field */
  onUpdate: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => void;
}

export interface FieldWrapperProps {
  /** The field ID */
  fieldId: string;
  /** The form engine instance */
  engine: FormEngine;
  /** The UI store instance */
  ui: UIStore;
  /** Drag handle attributes from @dnd-kit (optional) */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  /** Drag listeners from @dnd-kit (optional) */
  dragListeners?: Record<string, Function>;
  /** Whether the field is being dragged */
  isDragging?: boolean;
  /** Render function that receives field data and tools */
  children: (props: FieldWrapperRenderProps) => React.ReactNode;
}

/**
 * FieldWrapper - Extensibility API for custom field components.
 * 
 * Wraps a field with selection highlighting, edit/delete buttons, and drag handles.
 * Exposes field data and tools to the render function, allowing users to create
 * custom field types while getting all the built-in editor functionality.
 * 
 * @example
 * ```tsx
 * <FieldWrapper fieldId={id} engine={engine} ui={ui}>
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
  engine,
  ui,
  dragHandleProps,
  dragListeners,
  isDragging = false,
  children,
}: FieldWrapperProps) {
  const field = engine.getState().getField(fieldId);
  const selectedFieldId = useSelectedFieldId(ui);
  const isSelected = selectedFieldId === fieldId;

  // Handlers
  const handleSelect = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      ui.getState().selectField(fieldId);
    },
    [ui, fieldId]
  );

  const handleRemove = React.useCallback(() => {
    engine.getState().removeField(fieldId);
  }, [engine, fieldId]);

  const handleUpdate = React.useCallback(
    (patch: Partial<Omit<FieldDefinition, 'fields'>>) => {
      engine.getState().updateField(fieldId, patch);
    },
    [engine, fieldId]
  );

  if (!field) {
    return null;
  }

  return (
    <div
      className={`field-wrapper ms:relative ms:mb-2 ms:p-3 ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:transition-all ${
        isSelected ? 'ms:ring-2 ms:ring-msprimary ms:border-msprimary' : ''
      } ${isDragging ? 'ms:opacity-50' : ''}`}
      onClick={handleSelect}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          className="drag-handle ms:absolute ms:left-1 ms:top-3 ms:cursor-grab active:ms:cursor-grabbing ms:text-mstextmuted hover:ms:text-mstext"
          style={{ touchAction: 'none' }}
          {...dragHandleProps}
          {...dragListeners}
        >
          <svg className="ms:w-4 ms:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}

      {/* Field Content */}
      <div className={dragHandleProps ? 'ms:ml-6' : ''}>
        {/* Field Type Badge + ID */}
        <div className="field-meta ms:flex ms:items-center ms:gap-2 ms:mb-1">
          <div className="field-type-badge ms:inline-block ms:px-2 ms:py-0.5 ms:text-xs ms:font-medium ms:bg-msbackgroundsecondary ms:text-mstextmuted ms:rounded">
            {field.definition.fieldType}
          </div>
          {field.definition.id && (
            <div className="field-id ms:text-xs ms:text-mstextmuted ms:font-mono">
              ID: {field.definition.id}
            </div>
          )}
        </div>
        {children({
          field,
          engine,
          ui,
          isSelected,
          onRemove: handleRemove,
          onUpdate: handleUpdate,
        })}
      </div>

      {/* Actions (shown on select) */}
      {isSelected && (
        <div className="field-actions ms:absolute ms:right-2 ms:top-2 ms:flex ms:gap-1">
          <button
            type="button"
            className="action-btn ms:p-1 ms:rounded ms:bg-transparent ms:text-mstextmuted hover:ms:text-msdanger hover:ms:bg-msbackgroundhover ms:border-0 ms:outline-none focus:ms:outline-none ms:transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            aria-label="Delete field"
          >
            <svg className="ms:w-4 ms:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
