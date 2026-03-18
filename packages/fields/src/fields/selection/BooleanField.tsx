import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@msheet/core';
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
      <div className="boolean-field-preview ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="ms:text-msdanger ms:ml-0.5">*</span>}
        </div>
        <div className="ms:flex ms:gap-2">
          {options.map((option) => {
            const inputId = `${instanceId}-boolean-answer-${def.id}-${option.id}`;
            const isSelected = selectedId === option.id;

            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className={`ms:flex-1 ms:flex ms:items-center ms:justify-center ms:px-4 ms:py-2 ms:h-10 ms:border-2 ms:rounded-lg ms:cursor-pointer ms:transition-all ${
                  isSelected
                    ? 'ms:bg-msprimary ms:text-mstextsecondary ms:border-msprimary'
                    : 'ms:border-msborder ms:bg-mssurface ms:hover:bg-msprimary/10 ms:hover:border-msprimary/50'
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
                    isSelected ? 'ms:text-mstextsecondary' : 'ms:text-mstext'
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
