import React from 'react';
import type { FieldComponentProps } from '@msheet/core';

export const LongTextField = React.memo(function LongTextField({
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

  if (isPreview) {
    return (
      <div className="longtext-field-preview ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && (
            <span className="ms:text-msdanger ms:ml-0.5">*</span>
          )}
        </div>
        <textarea
          id={`${instanceId}-longtext-answer-${def.id}`}
          aria-label={def.question || 'Question'}
          disabled={!isEnabled}
          aria-required={isRequired || undefined}
          value={response?.answer || ''}
          onChange={(e) => onResponse({ answer: e.target.value })}
          placeholder="Type your answer"
          className="ms:px-3 ms:py-2 ms:h-24 ms:w-full ms:min-w-0 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:shadow-sm ms:rounded-lg ms:max-h-60 ms:resize-y ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
          rows={4}
        />
      </div>
    );
  }

  return (
    <div className="longtext-field-edit ms:space-y-2">
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
      <textarea
        id={`${instanceId}-canvas-preview-${def.id}`}
        aria-label="Answer preview"
        value=""
        placeholder="Type your answer"
        className="ms:px-3 ms:py-2 ms:w-full ms:border ms:border-msborder ms:shadow-sm ms:rounded-lg ms:min-h-24 ms:max-h-56 ms:resize-y ms:bg-msbackground ms:text-mstextmuted"
        rows={4}
        disabled
      />
    </div>
  );
});
