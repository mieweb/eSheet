import * as React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { registerCustomFieldTypes } from '@esheet/fields';
import {
  MedicationReconciliation,
  type CodeLookupConfig,
  type Medication,
} from '@mieweb/ui';

export interface MedicationListFieldValue {
  medications: Medication[];
}

function parseValue(answer: string | undefined): MedicationListFieldValue {
  if (!answer) return { medications: [] };

  try {
    const parsed: unknown = JSON.parse(answer);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { medications: [] };
    }

    const { medications } = parsed as { medications?: unknown };
    return {
      medications: Array.isArray(medications)
        ? (medications as Medication[])
        : [],
    };
  } catch {
    return { medications: [] };
  }
}

export interface MedicationListFieldProps extends FieldComponentProps {
  codeLookup: CodeLookupConfig;
}

export function MedicationListField({
  field,
  response,
  isPreview,
  isEnabled,
  onResponse,
  codeLookup,
}: MedicationListFieldProps): React.JSX.Element {
  const definition = field.definition as {
    question?: string;
    medications?: Medication[];
    quickAddOptions?: string[];
  };
  const medications = React.useMemo(() => {
    if (response?.answer) return parseValue(response.answer).medications;
    return definition.medications ?? [];
  }, [response?.answer, definition.medications]);

  return (
    <MedicationReconciliation
      medications={medications}
      onChange={(next) =>
        onResponse({ answer: JSON.stringify({ medications: next }) })
      }
      title={definition.question ?? 'Presenting medications'}
      quickAddOptions={definition.quickAddOptions}
      codeLookup={codeLookup}
      readOnly={!(isPreview && isEnabled)}
    />
  );
}

export function registerMedicationListFieldType(options: {
  codeLookup: CodeLookupConfig;
}): void {
  const Field = (props: FieldComponentProps) => (
    <MedicationListField {...props} codeLookup={options.codeLookup} />
  );

  registerCustomFieldTypes({
    medicationList: {
      label: 'Medication Reconciliation',
      category: 'rich',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {
        question: 'Presenting medications',
        width: 'full',
        quickAddOptions: [
          'aspirin 81 mg tablet',
          'atorvastatin 20 mg tablet',
          'metformin 500 mg tablet',
        ],
      },
      component: Field,
    },
  });
}
