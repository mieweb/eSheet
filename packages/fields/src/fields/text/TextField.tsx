import React from 'react';
import type {
  FieldComponentProps,
  TextFieldDefinition,
  LongtextFieldDefinition,
} from '@esheet/core';
import { Input, DateInput } from '@mieweb/ui';
import { useLabelVariant } from '../../lib/context.js';

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

function toDateInputValue(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
}

function toStoredDateValue(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : value;
}

function formatDateInputValue(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate()
  ).padStart(2, '0')}/${date.getFullYear()}`;
}

function applyDateRangeOffset(
  date: Date,
  amount: number,
  unit: 'days' | 'months' | 'years'
): Date {
  const result = new Date(date);
  if (unit === 'days') {
    result.setDate(result.getDate() + amount);
  } else {
    const monthOffset = unit === 'months' ? amount : amount * 12;
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + monthOffset);
    const lastDay = new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();
    result.setDate(Math.min(day, lastDay));
  }

  return result;
}

function resolveDateRange(
  range: { amount: number; unit: 'days' | 'months' | 'years' } | undefined
): { minDate?: string; maxDate?: string } {
  if (!range) return {};
  const today = new Date();
  const amount = Math.abs(range.amount);
  return {
    minDate: formatDateInputValue(
      applyDateRangeOffset(today, -amount, range.unit)
    ),
    maxDate: formatDateInputValue(
      applyDateRangeOffset(today, amount, range.unit)
    ),
  };
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
  isSoftRequired,
  response,
  computedValue,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as TextFieldDefinition | LongtextFieldDefinition;
  const instanceId = form.getState().instanceId;
  const labelVariant = useLabelVariant(form, def);
  const inputType = def.inputType as NonNullable<typeof def.inputType>;
  const unit = def.unit || '';
  const isTel = inputType === 'tel';
  const placeholder = PLACEHOLDER[inputType] || 'Type your answer';
  const dateRange = resolveDateRange(def.dateRange);

  // When a computed value arrives and the user hasn't answered yet, seed it as
  // the response so it behaves like any other answered field (overwritable).
  React.useEffect(() => {
    if (computedValue !== undefined && !response?.answer) {
      onResponse({ answer: String(computedValue) });
    }
  }, [computedValue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPreview) {
    if (inputType === 'date' || inputType === 'datetime-local') {
      return (
        <div className="text-field-preview">
          <DateInput
            id={`${instanceId}-text-answer-${def.id}`}
            name={`esheet-${inputType}-answer-${def.id}`}
            label={def.question || 'Question'}
            labelVariant={labelVariant}
            required={isRequired || isSoftRequired}
            requiredVariant={isSoftRequired ? 'warning' : undefined}
            disabled={!isEnabled}
            aria-required={isRequired || undefined}
            value={
              inputType === 'date'
                ? toDateInputValue(response?.answer || '')
                : response?.answer || ''
            }
            onChange={(val) =>
              onResponse({
                answer: inputType === 'date' ? toStoredDateValue(val) : val,
              })
            }
            inputType={inputType}
            timeFormat={def.timeFormat}
            minDate={dateRange.minDate}
            maxDate={dateRange.maxDate}
            validateOnBlur
            showCalendar
          />
        </div>
      );
    }

    return (
      <div className="text-field-preview ms:relative">
        <Input
          id={`${instanceId}-text-answer-${def.id}`}
          label={def.question || 'Question'}
          labelVariant={labelVariant}
          required={isRequired || isSoftRequired}
          requiredVariant={isSoftRequired ? 'warning' : undefined}
          type={inputType}
          disabled={!isEnabled}
          aria-required={isRequired || undefined}
          value={response?.answer || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const val = isTel
              ? formatPhoneNumber(e.target.value)
              : e.target.value;
            onResponse({ answer: val });
          }}
          placeholder={placeholder}
          className={unit ? 'ms:pr-16' : ''}
        />
        {unit && (
          <span
            className={`ms:absolute ms:right-3 ms:flex ms:items-center ms:text-sm ms:text-mstextmuted ms:pointer-events-none ${
              labelVariant === 'floating'
                ? 'ms:inset-y-0'
                : 'ms:bottom-0 ms:h-10'
            }`}
          >
            {unit}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="text-field-edit ms:space-y-2">
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
      {inputType === 'date' || inputType === 'datetime-local' ? (
        <div className="ms:pointer-events-none ms:select-none">
          <DateInput
            id={`${instanceId}-canvas-preview-${def.id}`}
            aria-label="Answer preview"
            value=""
            inputType={inputType}
            disabled
            showCalendar
          />
        </div>
      ) : (
        <div className="ms:relative">
          <input
            id={`${instanceId}-canvas-preview-${def.id}`}
            aria-label="Answer preview"
            type={inputType}
            value=""
            placeholder={placeholder}
            className={`ms:px-4 ms:py-2 ms:w-full ms:border ms:border-msborder ms:shadow-sm ms:rounded-lg ms:bg-msbackground ms:text-mstextmuted ${
              unit ? 'ms:pr-16' : ''
            }`}
            disabled
          />
          {unit && (
            <span className="ms:absolute ms:right-3 ms:top-1/2 ms:-translate-y-1/2 ms:text-sm ms:text-mstextmuted">
              {unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
