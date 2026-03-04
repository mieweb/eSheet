import React from 'react';
import type { FieldComponentProps } from '@msheet/core';

// ---------------------------------------------------------------------------
// Phone number formatting
// ---------------------------------------------------------------------------

function formatPhoneNumber(value: string): string {
  if (!value) return value;

  if (value.startsWith('+')) {
    const digitsOnly = value.replace(/[^\d]/g, '');
    if (value.startsWith('+1') && digitsOnly.length === 11) {
      const us = digitsOnly.slice(1);
      return `+1 (${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6, 10)}`;
    }
    const idx = value.indexOf(' ');
    if (idx === -1) return value;
    return value.slice(0, idx + 1) + value.slice(idx + 1).replace(/\s+/g, '-');
  }

  const digits = value.replace(/[^\d]/g, '');
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

// ---------------------------------------------------------------------------
// Placeholder map
// ---------------------------------------------------------------------------

const PLACEHOLDER: Record<string, string> = {
  string: 'Enter text',
  number: 'Enter number',
  email: 'example@email.com',
  tel: '(555) 555-5555',
  date: 'MM/DD/YYYY',
  'datetime-local': 'MM/DD/YYYY HH:MM',
  month: 'MM/YYYY',
  time: 'HH:MM',
};

// ---------------------------------------------------------------------------
// TextField
// ---------------------------------------------------------------------------

export const TextField = React.memo(function TextField({
  field,
  form,
  isPreview,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const inputType = def.inputType || 'string';
  const unit = def.unit || '';
  const isTel = inputType === 'tel';
  const placeholder = PLACEHOLDER[inputType] || 'Type your answer';

  if (isPreview) {
    return (
      <div className="text-field-preview">
        <div className="ms:grid ms:grid-cols-1 ms:gap-2 sm:ms:grid-cols-2 ms:pb-4">
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>
          <div className="ms:relative">
            <input
              id={`${instanceId}-text-answer-${def.id}`}
              aria-label={def.question || 'Question'}
              type={inputType}
              value={response?.answer || ''}
              onChange={(e) => {
                const val = isTel ? formatPhoneNumber(e.target.value) : e.target.value;
                onResponse({ answer: val });
              }}
              placeholder={placeholder}
              className={`ms:px-4 ms:py-2 ms:h-10 ms:w-full ms:min-w-0 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:shadow-sm ms:rounded-lg focus:ms:border-msprimary focus:ms:ring-1 focus:ms:ring-msprimary/30 ms:outline-none ms:transition-colors ${unit ? 'ms:pr-16' : ''}`}
            />
            {unit && (
              <span className="ms:absolute ms:right-3 ms:top-1/2 ms:-translate-y-1/2 ms:text-sm ms:text-mstextmuted ms:pointer-events-none">
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-field-edit ms:space-y-2">
      <div>
        <label
          htmlFor={`${instanceId}-text-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-text-question-${def.id}`}
          aria-label="Question"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg focus:ms:border-msprimary focus:ms:ring-1 focus:ms:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>
      <div className="ms:relative">
        <input
          id={`${instanceId}-text-preview-${def.id}`}
          aria-label="Answer preview"
          type={inputType}
          value=""
          placeholder={placeholder}
          className={`ms:px-4 ms:py-2 ms:w-full ms:border ms:border-msborder ms:shadow-sm ms:rounded-lg ms:bg-msbackground ms:text-mstextmuted ${unit ? 'ms:pr-16' : ''}`}
          disabled
        />
        {unit && (
          <span className="ms:absolute ms:right-3 ms:top-1/2 ms:-translate-y-1/2 ms:text-sm ms:text-mstextmuted">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
});
