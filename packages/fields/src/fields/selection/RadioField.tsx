import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { CustomRadio } from '../../controls/CustomRadio.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const RadioField = React.memo(function RadioField({
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
  const selectedId =
    (response?.selected as SelectedOption | undefined)?.id ?? null;

  if (isPreview) {
    return (
      <div className="radio-field-preview es:grid es:grid-cols-1 es:gap-2 es:sm:grid-cols-2 es:pb-4">
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        <div>
          {options.map((option) => {
            const inputId = `${instanceId}-radio-answer-${def.id}-${option.id}`;
            const isSelected = selectedId === option.id;

            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className="es:flex es:items-center es:gap-3 es:px-3 es:py-2 es:my-2 es:cursor-pointer es:rounded-lg es:hover:bg-esprimary/10 es:transition-colors"
              >
                <CustomRadio
                  id={inputId}
                  name={`question-${def.id}`}
                  value={option.id}
                  checked={isSelected}
                  disabled={!isEnabled}
                  onSelect={() =>
                    onResponse({
                      selected: { id: option.id, value: option.value },
                    })
                  }
                  onUnselect={() => onResponse({ selected: undefined })}
                  size="lg"
                />
                <span className="es:text-estext">{option.value}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="radio-field-edit es:space-y-3">
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
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
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
              <span className="es:shrink-0 es:w-4 es:h-4 es:rounded-full es:border es:border-esborder es:bg-essurface" />
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
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="es:shrink-0 es:text-estextmuted es:hover:text-esdanger es:transition-colors es:bg-transparent es:border-0 es:outline-none es:focus:outline-none"
                title="Remove option"
              >
                <TrashIcon className="es:w-4 es:h-4" />
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
});
