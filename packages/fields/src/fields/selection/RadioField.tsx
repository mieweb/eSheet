import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@msheet/core';
import { CustomRadio } from '../../controls/CustomRadio.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const RadioField = React.memo(function RadioField({
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
  const selectedId = (response?.selected as SelectedOption | undefined)?.id ?? null;

  if (isPreview) {
    return (
      <div className="radio-field-preview">
        <div className="ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>
          <div>
            {options.map((option) => {
              const inputId = `${instanceId}-radio-answer-${def.id}-${option.id}`;
              const isSelected = selectedId === option.id;

              return (
                <label
                  key={option.id}
                  htmlFor={inputId}
                  className="ms:flex ms:items-center ms:gap-3 ms:px-3 ms:py-2 ms:my-2 ms:cursor-pointer ms:rounded-lg ms:hover:bg-msprimary/10 ms:transition-colors"
                >
                  <CustomRadio
                    id={inputId}
                    name={`question-${def.id}`}
                    value={option.id}
                    checked={isSelected}
                    onSelect={() =>
                      onResponse({ selected: { id: option.id, value: option.value } })
                    }
                    onUnselect={() => onResponse({ selected: undefined })}
                    size="lg"
                  />
                  <span className="ms:text-mstext">{option.value}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="radio-field-edit ms:space-y-3">
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
              <span className="ms:shrink-0 ms:w-4 ms:h-4 ms:rounded-full ms:border ms:border-msborder ms:bg-mssurface" />
              <input
                id={`${instanceId}-canvas-option-${def.id}-${option.id}`}
                aria-label={`Option ${option.id}`}
                type="text"
                value={option.value}
                onChange={(e) =>
                  form.getState().updateOption(def.id, option.id, e.target.value)
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
