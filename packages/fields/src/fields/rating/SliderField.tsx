import React from 'react';
import type {
  FieldComponentProps,
  SelectedOption,
  SliderFieldDefinition,
} from '@esheet/core';
import { Slider } from '@mieweb/ui';
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
  const def = field.definition as SliderFieldDefinition;
  const instanceId = form.getState().instanceId;
  const options = def.options || [];
  const selectedId =
    (response?.selected as SelectedOption | undefined)?.id ?? null;
  const selectedIndex = options.findIndex((opt) => opt.id === selectedId);

  if (isPreview) {
    return (
      <div
        className={`slider-field-preview ms:text-mstext ms:grid ms:gap-2 ms:pb-4 ${
          options.length > 5
            ? 'ms:grid-cols-1'
            : 'ms:grid-cols-1 ms:sm:grid-cols-2'
        }`}
      >
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="ms:text-msdanger ms:ml-0.5">*</span>}
        </div>
        {options.length > 0 ? (
          <Slider
            id={`${instanceId}-slider-answer-${def.id}`}
            min={0}
            max={options.length - 1}
            step={1}
            value={selectedIndex >= 0 ? selectedIndex : 0}
            disabled={!isEnabled}
            onValueChange={(val) => {
              const opt = options[val];
              if (opt)
                onResponse({ selected: { id: opt.id, value: opt.value } });
            }}
            formatValue={(val) => options[val]?.value ?? ''}
            minLabel={options[0]?.value}
            maxLabel={options[options.length - 1]?.value}
            showValue
          />
        ) : (
          <div className="ms:text-sm ms:text-mstextmuted ms:italic">
            No options available
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="slider-field-edit ms:space-y-3">
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
                value={option.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateOption(def.id, option.id, e.target.value)
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
