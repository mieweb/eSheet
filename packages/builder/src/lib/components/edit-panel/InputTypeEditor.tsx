import type { TextInputType } from '@esheet/core';
import { useInstanceId } from '../../EsheetBuilder.js';

type RelativeDateRange = {
  amount: number;
  unit: 'days' | 'months' | 'years';
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INPUT_TYPES: { value: TextInputType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telephone' },
  { value: 'date', label: 'Date' },
  { value: 'datetime-local', label: 'Date & Time' },
  { value: 'month', label: 'Month' },
  { value: 'time', label: 'Time' },
  { value: 'url', label: 'URL' },
];

const UNITS: Record<string, string[]> = {
  Length: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
  Weight: ['mg', 'g', 'kg', 'oz', 'lb'],
  Volume: ['mL', 'L', 'fl oz', 'gal'],
  Temperature: ['°C', '°F', '°K'],
  Other: ['%', 'bpm', 'mmHg', 'cmH₂O'],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface InputTypeEditorProps {
  fieldId: string;
  inputType: TextInputType;
  unit?: string;
  dateRange?: RelativeDateRange;
  timeFormat?: '12-hour' | '24-hour';
  onChange: (patch: {
    inputType?: TextInputType;
    unit?: string;
    dateRange?: RelativeDateRange;
    timeFormat?: '12-hour' | '24-hour';
  }) => void;
}

/**
 * InputTypeEditor — dropdown for input type + optional unit selector.
 * Only relevant for `text` and `longtext` fields.
 */
export function InputTypeEditor({
  fieldId,
  inputType,
  unit,
  dateRange,
  timeFormat,
  onChange,
}: InputTypeEditorProps) {
  const instanceId = useInstanceId();
  const showUnit = inputType === 'number';
  const showDateRange = inputType === 'date' || inputType === 'datetime-local';
  const showTimeFormat = inputType === 'datetime-local';

  return (
    <div className="input-type-editor ms:space-y-2">
      {/* Input Type */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-inputtype-${fieldId}`}
          className="edit-label ms:block ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Input Type
        </label>
        <select
          id={`${instanceId}-editor-inputtype-${fieldId}`}
          value={inputType}
          onChange={(e) =>
            onChange({ inputType: e.currentTarget.value as TextInputType })
          }
          className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
        >
          {INPUT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Unit (only for number) */}
      {showUnit && (
        <div>
          <label
            htmlFor={`${instanceId}-editor-unit-${fieldId}`}
            className="edit-label ms:block ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Unit
          </label>
          <select
            id={`${instanceId}-editor-unit-${fieldId}`}
            value={unit ?? ''}
            onChange={(e) =>
              onChange({ unit: e.currentTarget.value || undefined })
            }
            className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
          >
            <option value="">None</option>
            {Object.entries(UNITS).map(([group, units]) => (
              <optgroup key={group} label={group}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {showDateRange && (
        <div className="ms:space-y-2">
          <RelativeDateRangeEditor
            fieldId={fieldId}
            instanceId={instanceId}
            value={dateRange}
            onChange={(value) => onChange({ dateRange: value })}
          />
        </div>
      )}

      {showTimeFormat && (
        <div>
          <label
            htmlFor={`${instanceId}-editor-timeformat-${fieldId}`}
            className="edit-label ms:block ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Time format
          </label>
          <select
            id={`${instanceId}-editor-timeformat-${fieldId}`}
            value={timeFormat ?? '24-hour'}
            onChange={(e) =>
              onChange({
                timeFormat: e.currentTarget.value as '12-hour' | '24-hour',
              })
            }
            className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
          >
            <option value="24-hour">24-hour</option>
            <option value="12-hour">12-hour</option>
          </select>
        </div>
      )}
    </div>
  );
}

function RelativeDateRangeEditor({
  fieldId,
  instanceId,
  value,
  onChange,
}: {
  fieldId: string;
  instanceId: string;
  value?: RelativeDateRange;
  onChange: (value: RelativeDateRange) => void;
}) {
  const amountId = `${instanceId}-editor-daterange-amount-${fieldId}`;
  const unitId = `${instanceId}-editor-daterange-unit-${fieldId}`;
  const offset = value ?? { amount: 0, unit: 'years' as const };

  return (
    <div>
      <label
        htmlFor={amountId}
        className="edit-label ms:block ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1"
      >
        Date range around today
      </label>
      <div className="ms:grid ms:grid-cols-2 ms:gap-2">
        <input
          id={amountId}
          aria-label="Date range amount"
          type="number"
          min="0"
          value={offset.amount}
          onChange={(e) =>
            onChange({
              ...offset,
              amount: Math.max(0, Number(e.currentTarget.value) || 0),
            })
          }
          className="ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
        />
        <select
          id={unitId}
          aria-label="Date range unit"
          value={offset.unit}
          onChange={(e) =>
            onChange({
              ...offset,
              unit: e.currentTarget.value as RelativeDateRange['unit'],
            })
          }
          className="ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
        >
          <option value="days">Days</option>
          <option value="months">Months</option>
          <option value="years">Years</option>
        </select>
      </div>
    </div>
  );
}
