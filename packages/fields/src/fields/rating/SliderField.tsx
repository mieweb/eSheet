import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const SliderField = React.memo(function SliderField({
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
        className={`slider-field-preview es:text-estext es:grid es:gap-2 es:pb-4 ${
          options.length > 5
            ? 'es:grid-cols-1'
            : 'es:grid-cols-1 es:sm:grid-cols-2'
        }`}
      >
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        {options.length > 0 ? (
          <div className="es:relative es:pt-1">
            <input
              id={`${instanceId}-slider-answer-${def.id}`}
              aria-label={def.question || 'Question'}
              type="range"
              min="0"
              max={options.length - 1}
              step="1"
              value={selectedIndex >= 0 ? selectedIndex : 0}
              disabled={!isEnabled}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                const opt = options[idx];
                if (opt)
                  onResponse({ selected: { id: opt.id, value: opt.value } });
              }}
              className="es:w-full es:h-1 es:bg-esborder es:rounded-lg es:appearance-none es:cursor-pointer slider-thumb"
            />

            <div className="es:relative es:mt-2 es:px-2">
              <div className="es:relative es:h-4 es:text-estextmuted es:text-center">
                {options.map((option, index) => {
                  const position =
                    options.length > 1
                      ? (index / (options.length - 1)) * 100
                      : 50;
                  return (
                    <span
                      key={option.id}
                      className="es:absolute"
                      style={{
                        left: `${position}%`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      ╹
                    </span>
                  );
                })}
              </div>
              <div className="es:relative es:mt-1">
                {options.map((option, index) => {
                  const position =
                    options.length > 1
                      ? (index / (options.length - 1)) * 100
                      : 50;
                  return (
                    <div
                      key={option.id}
                      className="es:absolute"
                      style={{
                        left: `${position}%`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onResponse({
                            selected: { id: option.id, value: option.value },
                          })
                        }
                        className="es:cursor-pointer es:bg-transparent es:border-0 es:outline-none es:focus:outline-none es:whitespace-nowrap"
                      >
                        <span
                          className={`es:text-sm ${
                            selectedIndex === index
                              ? 'es:text-esprimary es:font-semibold'
                              : 'es:text-estextmuted es:hover:text-esprimary'
                          }`}
                        >
                          {option.value}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
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
    <div className="slider-field-edit es:space-y-3">
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
                value={option.value}
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
