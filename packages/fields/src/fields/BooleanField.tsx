import React from 'react';
import type { SelectedOption, FieldComponentProps } from '@msheet/core';
import { CustomRadio } from '../controls/CustomRadio.js';

const DEFAULT_OPTIONS = [
  { id: 'yes', value: 'Yes' },
  { id: 'no', value: 'No' },
] as const;

export const BooleanField = React.memo(function BooleanField({
  field,
  form,
  isPreview,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const selected = response?.selected as SelectedOption | undefined;

  if (isPreview) {
    const options = def.options || [];

    return (
      <div className="boolean-field-preview">
        <div className="ms:grid ms:grid-cols-1 ms:gap-2 sm:ms:grid-cols-2 ms:pb-4">
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>
          <div className="ms:flex ms:gap-2">
            {options.map((opt) => {
              const inputId = `${instanceId}-boolean-answer-${def.id}-${opt.id}`;
              const isSelected = selected?.id === opt.id;

              return (
                <label
                  key={opt.id}
                  htmlFor={inputId}
                  className={`ms:flex-1 ms:flex ms:items-center ms:justify-center ms:px-4 ms:py-2 ms:h-10 ms:border-2 ms:rounded-lg ms:cursor-pointer ms:transition-all ${
                    isSelected
                      ? 'ms:bg-msprimary ms:text-mstextsecondary ms:border-msprimary'
                      : 'ms:border-msborder ms:bg-mssurface hover:ms:bg-msprimary/10 hover:ms:border-msprimary/50'
                  }`}
                >
                  <CustomRadio
                    id={inputId}
                    name={`boolean-${def.id}`}
                    value={opt.id}
                    checked={isSelected}
                    onSelect={() =>
                      onResponse({ selected: { id: opt.id, value: opt.value } })
                    }
                    onUnselect={() => onResponse({ selected: undefined })}
                    hidden
                  />
                  <span
                    className={
                      isSelected
                        ? 'ms:text-mstextsecondary'
                        : 'ms:text-mstext'
                    }
                  >
                    {opt.value}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ────────── Build Mode ──────────
  const options =
    def.options && def.options.length === 2
      ? def.options
      : [...DEFAULT_OPTIONS];

  return (
    <div className="boolean-field-edit ms:space-y-2">
      <div>
        <label
          htmlFor={`${instanceId}-boolean-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-boolean-question-${def.id}`}
          aria-label="Question"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg focus:ms:border-msprimary focus:ms:ring-1 focus:ms:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      <div className="ms:space-y-2">
        {options.map((opt) => (
          <div
            key={opt.id}
            className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm hover:ms:border-mstextmuted ms:transition-colors"
          >
            <span className="ms:shrink-0 ms:w-4 ms:h-4 ms:rounded-full ms:border ms:border-msborder ms:bg-mssurface" />
            <input
              id={`${instanceId}-boolean-option-${def.id}-${opt.id}`}
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
