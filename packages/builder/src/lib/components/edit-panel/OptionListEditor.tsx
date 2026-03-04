import React from 'react';
import type { FormStore, FieldOption } from '@msheet/core';
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
export function OptionListEditor({ fieldId, fieldType, options, form }: OptionListEditorProps) {
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
      <div className="ms:flex ms:items-center ms:justify-between">
        <span className="edit-label ms:text-xs ms:font-medium ms:text-mstextmuted">{label}</span>
        {!isBoolean && (
          <button
            type="button"
            onClick={handleAdd}
            className="add-option-btn ms:text-xs ms:text-msprimary ms:bg-transparent ms:border-0 ms:outline-none focus:ms:outline-none ms:cursor-pointer ms:hover:underline"
          >
            + Add {fieldType === 'multitext' ? 'Input' : 'Option'}
          </button>
        )}
      </div>

      <div ref={listRef} className="option-list ms:space-y-1 ms:max-h-48 ms:overflow-y-auto">
        {options.map((opt, idx) => (
          <div key={opt.id} className="option-row ms:flex ms:items-center ms:gap-1">
            <span className="ms:text-xs ms:text-mstextmuted ms:w-5 ms:text-right ms:shrink-0">
              {idx + 1}.
            </span>
            <input
              id={`${instanceId}-editor-option-${fieldId}-${opt.id}`}
              aria-label={`Option ${idx + 1}`}
              type="text"
              value={opt.value}
              onChange={(e) => form.getState().updateOption(fieldId, opt.id, e.currentTarget.value)}
              placeholder={`Option ${idx + 1}`}
              className="ms:flex-1 ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstext placeholder:ms:text-mstextmuted focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary focus:ms:border-msprimary"
            />
            {!isBoolean && (
              <button
                type="button"
                onClick={() => form.getState().removeOption(fieldId, opt.id)}
                aria-label={`Remove option ${idx + 1}`}
                className="remove-option-btn ms:p-1 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none focus:ms:outline-none ms:shrink-0"
              >
                <svg className="ms:w-3.5 ms:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
