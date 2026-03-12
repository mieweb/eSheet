import React from 'react';
import type { FormStore, FieldOption } from '@msheet/core';
import { TrashIcon } from '@msheet/fields';
import { useInstanceId } from '../../MsheetBuilder.js';

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
    <div className="option-list-editor ms:space-y-2">
      <span className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext">
        {label}
      </span>

      <div ref={listRef} className="option-list ms:space-y-2">
        {options.map((opt, idx) => (
          <div
            key={opt.id}
            className="option-row ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:hover:border-msprimary/50 ms:transition-colors"
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
              className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext ms:placeholder:text-mstextmuted ms:border-0 ms:text-sm"
            />
            {!isBoolean && (
              <button
                type="button"
                onClick={() => form.getState().removeOption(fieldId, opt.id)}
                aria-label={`Remove option ${idx + 1}`}
                className="remove-option-btn ms:shrink-0 ms:p-0.5 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:transition-colors ms:cursor-pointer"
              >
                <TrashIcon className="ms:w-4 ms:h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!isBoolean && (
        <button
          type="button"
          onClick={handleAdd}
          className="add-option-btn ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:bg-mssurface ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:hover:bg-msprimary/10 ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
        >
          + Add {fieldType === 'multitext' ? 'Input' : 'Option'}
        </button>
      )}
    </div>
  );
}
