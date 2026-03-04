import React from 'react';
import type { FieldComponentProps } from '@msheet/core';

// Inline SVG icons to avoid an external icon dependency
const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export const MultiTextField = React.memo(function MultiTextField({
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

  if (isPreview) {
    return (
      <div className="multitext-field-preview ms:text-mstext">
        <div className="ms:space-y-3 ms:pb-4">
          {def.question && (
            <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
              {def.question}
            </div>
          )}
          <div className="ms:space-y-2 ms:w-full">
            {options.map((opt) => {
              const inputId = `${instanceId}-multitext-answer-${def.id}-${opt.id}`;
              return (
                <div key={opt.id} className="ms:flex ms:flex-col ms:gap-1">
                  <label
                    htmlFor={inputId}
                    className="ms:text-xs ms:font-medium ms:text-mstextmuted ms:px-0 ms:text-left"
                  >
                    {opt.value}
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    value={response?.multitextAnswers?.[opt.id] || ''}
                    onChange={(e) =>
                      onResponse({
                        ...response,
                        multitextAnswers: {
                          ...response?.multitextAnswers,
                          [opt.id]: e.target.value,
                        },
                      })
                    }
                    placeholder=""
                    className="ms:w-full ms:px-4 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg focus:ms:border-msprimary focus:ms:ring-1 focus:ms:ring-msprimary ms:outline-none ms:transition-colors ms:min-w-0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="multitext-field-edit ms:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-multitext-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-multitext-question-${def.id}`}
          aria-label="Question"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg focus:ms:border-msprimary focus:ms:ring-1 focus:ms:ring-msprimary ms:outline-none ms:transition-colors"
        />
      </div>

      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Fields
        </span>
        <div className="ms:space-y-2">
          {options.map((opt) => (
            <div
              key={opt.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm hover:ms:border-mstextmuted ms:transition-colors"
            >
              <input
                id={`${instanceId}-multitext-field-${def.id}-${opt.id}`}
                aria-label={`Field ${opt.id}`}
                type="text"
                value={opt.value}
                onChange={(e) =>
                  form.getState().updateOption(def.id, opt.id, e.target.value)
                }
                placeholder="Field label"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                type="button"
                onClick={() => form.getState().removeOption(def.id, opt.id)}
                className="ms:shrink-0 ms:text-mstextmuted hover:ms:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none focus:ms:outline-none"
                title="Remove field"
              >
                <TrashIcon className="ms:w-4 ms:h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => form.getState().addOption(def.id)}
        className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:bg-mssurface hover:ms:bg-msprimary/10 ms:transition-colors ms:flex ms:items-center ms:justify-center ms:gap-2"
      >
        <PlusIcon className="ms:w-5 ms:h-5" /> Add Field
      </button>
    </div>
  );
});
