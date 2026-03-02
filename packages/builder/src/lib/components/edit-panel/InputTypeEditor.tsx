import type { TextInputType } from '@msheet/core';
import { useInstanceId } from '../../MsheetBuilder.js';

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
  onChange: (patch: { inputType?: TextInputType; unit?: string }) => void;
}

/**
 * InputTypeEditor — dropdown for input type + optional unit selector.
 * Only relevant for `text` and `longtext` fields.
 */
export function InputTypeEditor({ fieldId, inputType, unit, onChange }: InputTypeEditorProps) {
  const instanceId = useInstanceId();
  const showUnit = inputType === 'number';

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
          onChange={(e) => onChange({ inputType: e.currentTarget.value as TextInputType })}
          className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary focus:ms:border-msprimary"
        >
          {INPUT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
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
            onChange={(e) => onChange({ unit: e.currentTarget.value || undefined })}
            className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary focus:ms:border-msprimary"
          >
            <option value="">None</option>
            {Object.entries(UNITS).map(([group, units]) => (
              <optgroup key={group} label={group}>
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
