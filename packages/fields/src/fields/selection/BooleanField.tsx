import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { CustomRadio } from '../../controls/CustomRadio.js';

export const BooleanField = React.memo(function BooleanField({
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
  const options =
    def.options && def.options.length === 2
      ? def.options
      : [
          { id: 'yes', value: 'Yes' },
          { id: 'no', value: 'No' },
        ];
  const selectedId =
    (response?.selected as SelectedOption | undefined)?.id ?? null;

  if (isPreview) {
    return (
      <div className="boolean-field-preview es:grid es:grid-cols-1 es:gap-2 es:sm:grid-cols-2 es:pb-4">
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        <div className="es:flex es:gap-2">
          {options.map((option) => {
            const inputId = `${instanceId}-boolean-answer-${def.id}-${option.id}`;
            const isSelected = selectedId === option.id;

            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className={`es:flex-1 es:flex es:items-center es:justify-center es:px-4 es:py-2 es:h-10 es:border-2 es:rounded-lg es:cursor-pointer es:transition-all ${
                  isSelected
                    ? 'es:bg-esprimary es:text-estextsecondary es:border-esprimary'
                    : 'es:border-esborder es:bg-essurface es:hover:bg-esprimary/10 es:hover:border-esprimary/50'
                }`}
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
                  hidden
                />
                <span
                  className={
                    isSelected ? 'es:text-estextsecondary' : 'es:text-estext'
                  }
                >
                  {option.value}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="boolean-field-edit es:space-y-2">
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
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
        />
      </div>

      <div className="es:space-y-2">
        {options.map((opt) => (
          <div
            key={opt.id}
            className="es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:bg-essurface es:rounded-lg es:shadow-sm es:hover:border-estextmuted es:transition-colors"
          >
            <span className="es:shrink-0 es:w-4 es:h-4 es:rounded-full es:border es:border-esborder es:bg-essurface" />
            <input
              id={`${instanceId}-canvas-option-${def.id}-${opt.id}`}
              aria-label={`Option ${opt.id}`}
              type="text"
              value={opt.value}
              onChange={(e) =>
                form.getState().updateOption(def.id, opt.id, e.target.value)
              }
              placeholder={`Option ${opt.id}`}
              className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
            />
          </div>
        ))}
      </div>
    </div>
  );
});
