import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@msheet/core';
import { CustomDropdown } from '../../controls/CustomDropdown.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const MultiSelectDropdownField = React.memo(
  function MultiSelectDropdownField({
    field,
    form,
    isPreview,
    response,
    onUpdate,
    onResponse,
  }: FieldComponentProps) {
    const def = field.definition;
    const instanceId = form.getState().instanceId;
    const options = def.options || [];
    const selectedArr =
      (response?.selected as SelectedOption[] | undefined) ?? [];
    const selectedIds = selectedArr.map((s) => s.id);

    const handleChange = (newIds: string[]) => {
      const next = newIds
        .map((id) => {
          const opt = options.find((o) => o.id === id);
          return opt ? { id: opt.id, value: opt.value } : null;
        })
        .filter((s): s is SelectedOption => s != null);
      onResponse({ selected: next });
    };

    if (isPreview) {
      return (
        <div className="multiselect-dropdown-preview ms:text-mstext ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>
          <CustomDropdown
            options={options}
            value={selectedIds}
            onChange={handleChange}
            placeholder="Select an option"
            isMulti
          />
        </div>
      );
    }

    return (
      <div className="multiselect-dropdown-edit ms:space-y-3">
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
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:outline-none"
            type="text"
            value={def.question || ''}
            onChange={(e) => onUpdate({ question: e.target.value })}
            placeholder="Enter question"
          />
        </div>

        <div className="ms:w-full ms:min-h-10 ms:px-4 ms:py-2 ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:bg-msbackground ms:flex ms:flex-wrap ms:gap-2 ms:items-center">
          <span className="ms:text-mstextmuted ms:text-sm">
            Multi-select dropdown (Preview mode only)
          </span>
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
                  onClick={() =>
                    form.getState().removeOption(def.id, option.id)
                  }
                  className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                  title="Remove option"
                >
                  <TrashIcon className="ms:w-5 ms:h-5" />
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
  }
);
