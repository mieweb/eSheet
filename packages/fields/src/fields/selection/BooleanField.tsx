import React from 'react';
import type {
  FieldComponentProps,
  SelectedOption,
  BooleanFieldDefinition,
} from '@esheet/core';

export const BooleanField = React.memo(function BooleanField({
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
  const def = field.definition as BooleanFieldDefinition;
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
      <div className="boolean-field-preview ms:space-y-1.5">
        <div className="ms:text-sm ms:font-medium ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
        </div>
        <div className="ms:flex ms:gap-2">
          {options.map((option) => {
            const isSelected = selectedId === option.id;

            return (
              <button
                key={option.id}
                id={`${instanceId}-boolean-answer-${def.id}-${option.id}`}
                type="button"
                disabled={!isEnabled}
                className={`ms:flex-1 ms:px-3 ms:py-2 ms:rounded-lg ms:text-sm ms:font-medium ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:disabled:opacity-50 ms:disabled:cursor-not-allowed ${
                  isSelected
                    ? 'ms:bg-msprimary ms:text-mstextsecondary ms:border ms:border-msprimary ms:shadow-sm'
                    : 'ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:hover:bg-msprimary/15 ms:hover:border-msprimary/50'
                }`}
                onClick={() => {
                  if (isSelected) {
                    onResponse({ selected: undefined });
                  } else {
                    onResponse({
                      selected: { id: option.id, value: option.value },
                    });
                  }
                }}
              >
                {option.value}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="boolean-field-edit ms:space-y-2">
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
        />
      </div>

      <div className="ms:space-y-2">
        {options.map((opt) => (
          <div
            key={opt.id}
            className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
          >
            <span className="ms:shrink-0 ms:w-4 ms:h-4 ms:rounded-full ms:border ms:border-msborder ms:bg-mssurface" />
            <input
              id={`${instanceId}-canvas-option-${def.id}-${opt.id}`}
              aria-label={`Option ${opt.id}`}
              type="text"
              value={opt.value}
              onChange={(e) =>
                form.getState().updateOption(def.id, opt.id, e.target.value)
              }
              placeholder={`Option ${opt.id}`}
              className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
            />
          </div>
        ))}
      </div>
    </div>
  );
});
