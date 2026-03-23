import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { CustomRadio } from '../../controls/CustomRadio.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const RatingField = React.memo(function RatingField({
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
  const selectedIndex = options.findIndex((opt) => opt.id === selectedId);

  if (isPreview) {
    return (
      <div
        className={`rating-field-preview es:text-estext es:grid es:gap-2 es:pb-4 ${
          options.length > 5
            ? 'es:grid-cols-1'
            : 'es:grid-cols-1 es:lg:grid-cols-2'
        }`}
      >
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        {options.length > 0 ? (
          <div className="es:flex es:flex-wrap es:justify-evenly es:gap-2">
            {options.map((option, index) => {
              const inputId = `${instanceId}-rating-answer-${def.id}-${option.id}`;
              const isSelected = selectedIndex === index;
              const labelClasses = isSelected
                ? 'es:flex es:items-center es:justify-center es:min-w-11 es:h-11 es:px-3 es:rounded-full es:border-2 es:transition-all es:cursor-pointer es:bg-esprimary es:text-estextsecondary es:border-esprimary es:scale-105'
                : 'es:flex es:items-center es:justify-center es:min-w-11 es:h-11 es:px-3 es:rounded-full es:border-2 es:transition-all es:cursor-pointer es:bg-essurface es:text-estext es:border-esborder es:hover:border-esprimary/50 es:hover:bg-esprimary/10 es:hover:scale-105';

              return (
                <label
                  key={option.id}
                  htmlFor={inputId}
                  className={labelClasses}
                >
                  <CustomRadio
                    id={inputId}
                    name={`rating-${def.id}`}
                    value={option.id}
                    checked={isSelected}
                    disabled={!isEnabled}
                    onSelect={() =>
                      onResponse({
                        selected: { id: option.id, value: option.value },
                      })
                    }
                    onUnselect={() => onResponse({ selected: undefined })}
                    hidden
                  />
                  <span className="es:text-sm es:font-medium es:whitespace-nowrap">
                    {option.text || option.value}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="es:text-sm es:text-estextmuted es:italic">
            No options available
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rating-field-edit es:space-y-3">
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
              <div className="es:w-3 es:h-3 es:rounded-full es:bg-esprimary es:shrink-0" />
              <input
                id={`${instanceId}-canvas-option-${def.id}-${option.id}`}
                aria-label={`Option ${option.id}`}
                type="text"
                value={option.text || option.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateOption(def.id, option.id, e.target.value)
                }
                placeholder="Option label"
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
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
});
