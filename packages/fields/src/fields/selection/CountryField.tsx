import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { CountryDropdown, type CountryData } from '@mieweb/ui';
import { registerCustomFieldTypes } from '../../lib/component-registry.js';
import { EditInput } from '../../lib/EditInput.js';

/**
 * Definition props for the `country` custom field type.
 *
 * Renders a searchable flag + name country picker and stores the choice as
 * `{ selected: { id: <ISO 3166-1 alpha-2>, value: <country name> } }`, like a
 * dropdown.
 */
export interface CountryFieldDefinition {
  /** Field id, assigned by the builder like every field definition. */
  id: string;
  question?: string;
}

/** Maps a picked country to the stored dropdown-style selection. */
export function countryToSelection(country: CountryData): SelectedOption {
  return { id: country.code, value: country.name };
}

export const CountryField = React.memo(function CountryField({
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
  const def = field.definition as unknown as CountryFieldDefinition;
  const instanceId = form.getState().instanceId;
  const selected = response?.selected as SelectedOption | undefined;

  if (isPreview) {
    return (
      <div className="country-field-preview ms:space-y-1.5">
        <div className="ms:text-sm ms:font-medium ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
        </div>
        <CountryDropdown
          id={`${instanceId}-country-answer-${def.id}`}
          aria-label={def.question || 'Question'}
          value={selected?.id}
          onChange={(country) =>
            onResponse({ selected: countryToSelection(country) })
          }
          disabled={!isEnabled}
        />
      </div>
    );
  }

  return (
    <div className="country-field-edit ms:space-y-3">
      <EditInput
        id={`${instanceId}-canvas-question-${def.id}`}
        label="Question"
        value={def.question || ''}
        onChange={(question) => onUpdate({ question })}
        placeholder="Enter question"
      />
    </div>
  );
});

/**
 * Registers the `country` custom field type: a searchable country picker
 * whose answer is the ISO alpha-2 code plus display name.
 *
 * @example
 * ```tsx
 * import { registerCountryFieldType } from '@esheet/fields';
 * registerCountryFieldType();
 * ```
 */
export function registerCountryFieldType(): void {
  registerCustomFieldTypes({
    country: {
      label: 'Country',
      category: 'selection',
      answerType: 'selection',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: { width: 'third' },
      placeholder: { question: 'Enter your question...' },
      component: CountryField,
    },
  });
}
