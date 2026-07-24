import * as React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { registerCustomFieldTypes } from '@esheet/fields';
import {
  AllergyManager,
  type Allergy,
  type CodeLookupConfig,
} from '@mieweb/ui';

export interface AllergyListFieldValue {
  allergies: Allergy[];
  noKnownAllergies?: boolean;
}

function parseValue(answer: string | undefined): AllergyListFieldValue {
  if (!answer) return { allergies: [] };

  try {
    const parsed: unknown = JSON.parse(answer);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { allergies: [] };
    }

    const { allergies, noKnownAllergies } = parsed as Partial<
      Record<keyof AllergyListFieldValue, unknown>
    >;
    return {
      allergies: Array.isArray(allergies) ? (allergies as Allergy[]) : [],
      noKnownAllergies:
        typeof noKnownAllergies === 'boolean' ? noKnownAllergies : undefined,
    };
  } catch {
    return { allergies: [] };
  }
}

export interface AllergyListFieldProps extends FieldComponentProps {
  codeLookup: CodeLookupConfig;
}

export function AllergyListField({
  field,
  response,
  isPreview,
  isEnabled,
  onResponse,
  codeLookup,
}: AllergyListFieldProps): React.JSX.Element {
  const definition = field.definition as {
    question?: string;
    allergies?: Allergy[];
  };
  const value = React.useMemo(() => {
    if (response?.answer) return parseValue(response.answer);
    return { allergies: definition.allergies ?? [] };
  }, [response?.answer, definition.allergies]);
  const commit = (next: AllergyListFieldValue) => {
    onResponse({ answer: JSON.stringify(next) });
  };

  return (
    <AllergyManager
      allergies={value.allergies}
      onChange={(allergies) =>
        commit({
          allergies,
          noKnownAllergies:
            allergies.length > 0 ? undefined : value.noKnownAllergies,
        })
      }
      noKnownAllergies={value.noKnownAllergies}
      onNoKnownAllergiesChange={(noKnownAllergies) =>
        commit({ allergies: value.allergies, noKnownAllergies })
      }
      title={definition.question ?? 'Allergies'}
      codeLookup={codeLookup}
      inlineAddSearch
      readOnly={!(isPreview && isEnabled)}
    />
  );
}

export function registerAllergyListFieldType(options: {
  codeLookup: CodeLookupConfig;
}): void {
  const Field = (props: FieldComponentProps) => (
    <AllergyListField {...props} codeLookup={options.codeLookup} />
  );

  registerCustomFieldTypes({
    allergyList: {
      label: 'Allergy List',
      category: 'rich',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {
        question: 'Allergies',
      },
      component: Field,
    },
  });
}
