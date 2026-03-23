import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { CustomDropdown } from '../../controls/CustomDropdown.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const MultiSelectDropdownField = React.memo(
  function MultiSelectDropdownField({
    field,
    form,
    isPreview,
    isEnabled,
    isRequired,
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
        <div className="multiselect-dropdown-preview es:text-estext es:grid es:grid-cols-1 es:gap-2 es:sm:grid-cols-2 es:pb-4">
          <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
            {def.question || 'Question'}
            {isRequired && (
              <span className="es:text-esdanger es:ml-0.5">*</span>
            )}
          </div>
          <CustomDropdown
            options={options}
            value={selectedIds}
            onChange={handleChange}
            placeholder="Select an option"
            disabled={!isEnabled}
            isMulti
          />
        </div>
      );
    }

    return (
      <div className="multiselect-dropdown-edit es:space-y-3">
        <div>
          <label
            htmlFor={`${instanceId}-canvas-question-${def.id}`}
            className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
          >
            Question
          </label>
          <input
            id={`${instanceId}-canvas-question-${def.id}`}
            aria-label="Question"
            className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:outline-none"
            type="text"
            value={def.question || ''}
            onChange={(e) => onUpdate({ question: e.target.value })}
            placeholder="Enter question"
          />
        </div>

        <div className="es:w-full es:min-h-10 es:px-4 es:py-2 es:shadow es:border es:border-esborder es:rounded-lg es:bg-esbackground es:flex es:flex-wrap es:gap-2 es:items-center">
          <span className="es:text-estextmuted es:text-sm">
            Multi-select dropdown (Preview mode only)
          </span>
        </div>

        <div>
          <span className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-2">
            Options
          </span>
          <div className="es:space-y-2">
            {options.map((option) => (
              <div
                key={option.id}
                className="es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:bg-essurface es:rounded-lg es:shadow-sm es:hover:border-estextmuted es:transition-colors"
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
                  className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
                />
                <button
                  onClick={() =>
                    form.getState().removeOption(def.id, option.id)
                  }
                  className="es:shrink-0 es:text-estextmuted es:hover:text-esdanger es:transition-colors es:bg-transparent es:border-0 es:outline-none es:focus:outline-none"
                  title="Remove option"
                >
                  <TrashIcon className="es:w-5 es:h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => form.getState().addOption(def.id)}
          className="es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:bg-essurface es:hover:bg-esprimary/10 es:transition-colors es:flex es:items-center es:justify-center es:gap-2"
        >
          <PlusIcon className="es:w-5 es:h-5" /> Add Option
        </button>
      </div>
    );
  }
);
