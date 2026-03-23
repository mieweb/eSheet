import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const MultiTextField = React.memo(function MultiTextField({
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
  const multitextAnswers = response?.multitextAnswers || {};

  if (isPreview) {
    return (
      <div className="multitext-field-preview es:text-estext es:space-y-3 es:pb-4">
        {(def.question || isRequired) && (
          <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
            {def.question || 'Question'}
            {isRequired && (
              <span className="es:text-esdanger es:ml-0.5">*</span>
            )}
          </div>
        )}
        <div className="es:space-y-2 es:w-full">
          {options.map((option) => {
            const inputId = `${instanceId}-multitext-answer-${def.id}-${option.id}`;
            return (
              <div key={option.id} className="es:flex es:flex-col es:gap-1">
                <label
                  htmlFor={inputId}
                  className="es:text-xs es:font-medium es:text-estextmuted es:px-0 es:text-left"
                >
                  {option.value}
                </label>
                <input
                  id={inputId}
                  type="text"
                  disabled={!isEnabled}
                  value={multitextAnswers[option.id] || ''}
                  onChange={(e) =>
                    onResponse({
                      multitextAnswers: {
                        ...multitextAnswers,
                        [option.id]: e.target.value,
                      },
                    })
                  }
                  placeholder=""
                  className="es:w-full es:px-4 es:py-2 es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:outline-none es:transition-colors es:min-w-0"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="multitext-field-edit es:space-y-3">
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
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:outline-none es:transition-colors"
        />
      </div>

      <div>
        <span className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-2">
          Fields
        </span>
        <div className="es:space-y-2">
          {options.map((option) => (
            <div
              key={option.id}
              className="es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:bg-essurface es:rounded-lg es:shadow-sm es:hover:border-estextmuted es:transition-colors"
            >
              <input
                id={`${instanceId}-canvas-field-${def.id}-${option.id}`}
                aria-label={`Field ${option.id}`}
                type="text"
                value={option.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateOption(def.id, option.id, e.target.value)
                }
                placeholder="Field label"
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="es:shrink-0 es:text-estextmuted es:hover:text-esdanger es:transition-colors es:bg-transparent es:border-0 es:outline-none es:focus:outline-none"
                title="Remove field"
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
        <PlusIcon className="es:w-5 es:h-5" /> Add Field
      </button>
    </div>
  );
});
