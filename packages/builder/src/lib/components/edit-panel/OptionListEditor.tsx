import React from 'react';
import type { FormStore, FieldOption } from '@esheet/core';
import { TrashIcon } from '@esheet/fields';
import { useInstanceId } from '../../EsheetBuilder.js';

export interface OptionListEditorProps {
  fieldId: string;
  fieldType: string;
  options: readonly FieldOption[];
  form: FormStore;
}

/**
 * OptionListEditor — add / edit / remove options for choice fields.
 *
 * Disables delete for boolean (fixed Yes/No).
 * Uses form.addOption / updateOption / removeOption directly.
 */
export function OptionListEditor({
  fieldId,
  fieldType,
  options,
  form,
}: OptionListEditorProps) {
  const instanceId = useInstanceId();
  const listRef = React.useRef<HTMLDivElement>(null);
  const isBoolean = fieldType === 'boolean';
  const label = fieldType === 'multitext' ? 'Text Inputs' : 'Options';

  const handleAdd = () => {
    form.getState().addOption(fieldId);
    // Scroll to bottom after render
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  return (
    <div className="option-list-editor es:space-y-2">
      <span className="edit-label es:block es:text-sm es:font-medium es:text-estext">
        {label}
      </span>

      <div ref={listRef} className="option-list es:space-y-2">
        {options.map((opt, idx) => (
          <div
            key={opt.id}
            className="option-row es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:rounded-lg es:shadow-sm es:hover:border-esprimary/50 es:transition-colors"
          >
            <input
              id={`${instanceId}-editor-option-${fieldId}-${opt.id}`}
              aria-label={`Option ${idx + 1}`}
              type="text"
              value={opt.value}
              onChange={(e) =>
                form
                  .getState()
                  .updateOption(fieldId, opt.id, e.currentTarget.value)
              }
              placeholder={`Option ${idx + 1}`}
              className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext es:placeholder:text-estextmuted es:border-0 es:text-sm"
            />
            {!isBoolean && (
              <button
                type="button"
                onClick={() => form.getState().removeOption(fieldId, opt.id)}
                aria-label={`Remove option ${idx + 1}`}
                className="remove-option-btn es:shrink-0 es:p-0.5 es:rounded es:bg-transparent es:text-estextmuted es:hover:text-esdanger es:border-0 es:outline-none es:focus:outline-none es:transition-colors es:cursor-pointer"
              >
                <TrashIcon className="es:w-4 es:h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!isBoolean && (
        <button
          type="button"
          onClick={handleAdd}
          className="add-option-btn es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:bg-essurface es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:hover:bg-esprimary/10 es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
        >
          + Add {fieldType === 'multitext' ? 'Input' : 'Option'}
        </button>
      )}
    </div>
  );
}
