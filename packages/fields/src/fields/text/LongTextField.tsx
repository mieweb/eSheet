import React from 'react';
import type { FieldComponentProps } from '@esheet/core';

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
      <div className="longtext-field-preview es:grid es:grid-cols-1 es:gap-2 es:sm:grid-cols-2 es:pb-4">
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        <textarea
          id={`${instanceId}-longtext-answer-${def.id}`}
          aria-label={def.question || 'Question'}
          disabled={!isEnabled}
          aria-required={isRequired || undefined}
          value={response?.answer || ''}
          onChange={(e) => onResponse({ answer: e.target.value })}
          placeholder="Type your answer"
          className="es:px-3 es:py-2 es:h-24 es:w-full es:min-w-0 es:border es:border-esborder es:bg-essurface es:text-estext es:shadow-sm es:rounded-lg es:max-h-60 es:resize-y es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
          rows={4}
        />
      </div>
    );
  }

  return (
    <div className="longtext-field-edit es:space-y-2">
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
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>
      <textarea
        id={`${instanceId}-canvas-preview-${def.id}`}
        aria-label="Answer preview"
        value=""
        placeholder="Type your answer"
        className="es:px-3 es:py-2 es:w-full es:border es:border-esborder es:shadow-sm es:rounded-lg es:min-h-24 es:max-h-56 es:resize-y es:bg-esbackground es:text-estextmuted"
        rows={4}
        disabled
      />
    </div>
  );
});
