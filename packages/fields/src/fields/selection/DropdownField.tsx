import React from 'react';
import type {
  FieldComponentProps,
  SelectedOption,
  DropdownFieldDefinition,
} from '@esheet/core';
import { Select } from '@mieweb/ui';
import { useLabelVariant } from '../../lib/context.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const DropdownField = React.memo(function DropdownField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as DropdownFieldDefinition;
  const instanceId = form.getState().instanceId;
  const labelVariant = useLabelVariant(form, def);
  const options = def.options || [];
  const selectedId =
    (response?.selected as SelectedOption | undefined)?.id ?? null;

  if (isPreview) {
    const clearOption = { value: '__clear__', label: '— None —' };
    const selectOptions = [
      ...(selectedId ? [clearOption] : []),
      ...options.map((o) => ({ value: o.id, label: o.value })),
    ];

    return (
      <div className="dropdown-field-preview">
        <Select
          id={`${instanceId}-dropdown-answer-${def.id}`}
          label={def.question || 'Question'}
          labelVariant={labelVariant}
          options={selectOptions}
          value={selectedId || ''}
          onValueChange={(val) => {
            if (!val || val === '__clear__') {
              onResponse({ selected: undefined });
            } else {
              const opt = options.find((o) => o.id === val);
              if (opt)
                onResponse({ selected: { id: opt.id, value: opt.value } });
            }
          }}
          placeholder="Select an option"
          disabled={!isEnabled}
        />
      </div>
    );
  }

  return (
    <div className="dropdown-field-edit ms:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Question"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Options
        </span>
        <div className="ms:space-y-2">
          {options.map((option) => (
            <div
              key={option.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
            >
              <input
                id={`${instanceId}-canvas-option-${def.id}-${option.id}`}
                aria-label={`Option ${option.id}`}
                type="text"
                value={option.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateOption(def.id, option.id, e.target.value)
                }
                placeholder="Option text"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove option"
              >
                <TrashIcon className="ms:w-4 ms:h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => form.getState().addOption(def.id)}
        className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:bg-mssurface ms:hover:bg-msprimary/10 ms:transition-colors ms:flex ms:items-center ms:justify-center ms:gap-2"
      >
        <PlusIcon className="ms:w-5 ms:h-5" /> Add Option
      </button>
    </div>
  );
});
