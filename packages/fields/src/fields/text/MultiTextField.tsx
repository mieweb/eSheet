import React from 'react';
import type { FieldComponentProps } from '@msheet/core';
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
      <div className="multitext-field-preview ms:text-mstext ms:space-y-3 ms:pb-4">
        {(def.question || isRequired) && (
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
            {isRequired && (
              <span className="ms:text-msdanger ms:ml-0.5">*</span>
            )}
          </div>
        )}
        <div className="ms:space-y-2 ms:w-full">
          {options.map((option) => {
            const inputId = `${instanceId}-multitext-answer-${def.id}-${option.id}`;
            return (
              <div key={option.id} className="ms:flex ms:flex-col ms:gap-1">
                <label
                  htmlFor={inputId}
                  className="ms:text-xs ms:font-medium ms:text-mstextmuted ms:px-0 ms:text-left"
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
                  className="ms:w-full ms:px-4 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:outline-none ms:transition-colors ms:min-w-0"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="multitext-field-edit ms:space-y-3">
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:outline-none ms:transition-colors"
        />
      </div>

      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Fields
        </span>
        <div className="ms:space-y-2">
          {options.map((option) => (
            <div
              key={option.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
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
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove field"
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
        <PlusIcon className="ms:w-5 ms:h-5" /> Add Field
      </button>
    </div>
  );
});
