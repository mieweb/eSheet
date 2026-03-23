import React from 'react';
import type { FieldComponentProps } from '@esheet/core';

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
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

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

export const TextField = React.memo(function TextField({
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
  const inputType = def.inputType || 'string';
  const unit = def.unit || '';
  const isTel = inputType === 'tel';
  const placeholder = PLACEHOLDER[inputType] || 'Type your answer';

  if (isPreview) {
    return (
      <div className="text-field-preview es:grid es:grid-cols-1 es:gap-2 es:sm:grid-cols-2 es:pb-4">
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        <div className="es:relative">
          <input
            id={`${instanceId}-text-answer-${def.id}`}
            aria-label={def.question || 'Question'}
            type={inputType}
            disabled={!isEnabled}
            aria-required={isRequired || undefined}
            value={response?.answer || ''}
            onChange={(e) => {
              const val = isTel
                ? formatPhoneNumber(e.target.value)
                : e.target.value;
              onResponse({ answer: val });
            }}
            placeholder={placeholder}
            className={`es:px-4 es:py-2 es:h-10 es:w-full es:min-w-0 es:border es:border-esborder es:bg-essurface es:text-estext es:shadow-sm es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors ${
              unit ? 'es:pr-16' : ''
            }`}
          />
          {unit && (
            <span className="es:absolute es:right-3 es:top-1/2 es:-translate-y-1/2 es:text-sm es:text-estextmuted es:pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-field-edit es:space-y-2">
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
      <div className="es:relative">
        <input
          id={`${instanceId}-canvas-preview-${def.id}`}
          aria-label="Answer preview"
          type={inputType}
          value=""
          placeholder={placeholder}
          className={`es:px-4 es:py-2 es:w-full es:border es:border-esborder es:shadow-sm es:rounded-lg es:bg-esbackground es:text-estextmuted ${
            unit ? 'es:pr-16' : ''
          }`}
          disabled
        />
        {unit && (
          <span className="es:absolute es:right-3 es:top-1/2 es:-translate-y-1/2 es:text-sm es:text-estextmuted">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
});
