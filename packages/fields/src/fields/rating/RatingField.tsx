import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@msheet/core';
import { CustomRadio } from '../../controls/CustomRadio.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const RatingField = React.memo(function RatingField({
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
  const selectedIndex = options.findIndex((opt) => opt.id === selectedId);

  if (isPreview) {
    return (
      <div className="rating-field-preview ms:text-mstext">
        <div
          className={`ms:grid ms:gap-2 ms:pb-4 ${options.length > 5 ? 'ms:grid-cols-1' : 'ms:grid-cols-1 ms:lg:grid-cols-2'}`}
        >
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>
          <div className="ms:py-2">
            {options.length > 0 ? (
              <div className="ms:flex ms:flex-wrap ms:justify-evenly ms:gap-2">
                {options.map((option, index) => {
                  const inputId = `${instanceId}-rating-answer-${def.id}-${option.id}`;
                  const isSelected = selectedIndex === index;
                  const labelClasses = isSelected
                    ? 'ms:flex ms:items-center ms:justify-center ms:min-w-11 ms:h-11 ms:px-3 ms:rounded-full ms:border-2 ms:transition-all ms:cursor-pointer ms:bg-msprimary ms:text-mstextsecondary ms:border-msprimary ms:scale-105'
                    : 'ms:flex ms:items-center ms:justify-center ms:min-w-11 ms:h-11 ms:px-3 ms:rounded-full ms:border-2 ms:transition-all ms:cursor-pointer ms:bg-mssurface ms:text-mstext ms:border-msborder ms:hover:border-msprimary/50 ms:hover:bg-msprimary/10 ms:hover:scale-105';

                  return (
                    <label key={option.id} htmlFor={inputId} className={labelClasses}>
                      <CustomRadio
                        id={inputId}
                        name={`rating-${def.id}`}
                        value={option.id}
                        checked={isSelected}
                        onSelect={() =>
                          onResponse({ selected: { id: option.id, value: option.value } })
                        }
                        onUnselect={() => onResponse({ selected: undefined })}
                        hidden
                      />
                      <span className="ms:text-sm ms:font-medium ms:whitespace-nowrap">
                        {option.text || option.value}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="ms:text-sm ms:text-mstextmuted ms:italic">No options available</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rating-field-edit ms:space-y-3">
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
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
              <div className="ms:w-3 ms:h-3 ms:rounded-full ms:bg-msprimary ms:shrink-0" />
              <input
                id={`${instanceId}-canvas-option-${def.id}-${option.id}`}
                aria-label={`Option ${option.id}`}
                type="text"
                value={option.text || option.value}
                onChange={(e) =>
                  form.getState().updateOption(def.id, option.id, e.target.value)
                }
                placeholder="Option label"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove option"
              >
                <TrashIcon className="ms:w-5 ms:h-5" />
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
