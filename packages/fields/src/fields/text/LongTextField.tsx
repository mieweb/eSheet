import React from 'react';
import type {
  FieldComponentProps,
  LongtextFieldDefinition,
} from '@esheet/core';
import { Textarea } from '@mieweb/ui';
import { useLabelVariant } from '../../lib/context.js';

export const LongTextField = React.memo(function LongTextField({
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
  const def = field.definition as LongtextFieldDefinition;
  const instanceId = form.getState().instanceId;
  const labelVariant = useLabelVariant(form, def);

  if (isPreview) {
    return (
      <div className="longtext-field-preview">
        <Textarea
          id={`${instanceId}-longtext-answer-${def.id}`}
          label={def.question || 'Question'}
          labelVariant={labelVariant}
          required={isRequired || isSoftRequired}
          requiredVariant={isSoftRequired ? 'warning' : undefined}
          disabled={!isEnabled}
          aria-required={isRequired || undefined}
          value={response?.answer || ''}
          onChange={(e) => onResponse({ answer: e.target.value })}
          placeholder="Type your answer"
          rows={4}
          className="ms:max-h-56 ms:resize-y"
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
