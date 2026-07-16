import type {
  FieldPresence,
  FieldProposal,
  FormDefinition,
  FormResponse,
} from '@esheet/core';

/** Form fixture used by the collaboration playground. */
export const COLLAB_FORM: FormDefinition = {
  id: 'collab-patient-review',
  title: 'Patient intake review',
  description:
    'Review a shared patient record while teammates suggest corrections.',
  fields: [
    {
      id: 'patient-name',
      fieldType: 'text',
      question: 'Patient name',
      required: true,
    },
    {
      id: 'patient-phone',
      fieldType: 'text',
      question: 'Phone number',
      inputType: 'tel',
    },
    {
      id: 'patient-notes',
      fieldType: 'longtext',
      question: 'Care notes',
    },
  ],
};

/** Canonical values that the mock host initially supplies to the Renderer. */
export const INITIAL_RESPONSES: FormResponse = {
  'patient-name': { answer: 'Jon Smith' },
  'patient-phone': { answer: '(317) 555-0100' },
  'patient-notes': { answer: 'Follow-up appointment requested.' },
};

/** Presence data that a real host would receive from its collaboration service. */
export const MOCK_PRESENCE: Record<string, FieldPresence[]> = {
  'patient-name': [
    { name: 'Alice Chen', color: '#ef4444' },
    { name: 'Marcus Lee', color: '#3b82f6' },
  ],
  'patient-notes': [{ name: 'Priya Shah', color: '#8b5cf6' }],
};

/** Creates the proposal snapshot supplied by the mock collaboration host. */
export function createMockProposals(
  conflicted: boolean
): Record<string, FieldProposal[]> {
  return {
    'patient-name': [
      {
        id: 'proposal-name-1',
        proposedValue: 'John Smith',
        baseValue: 'Jon Smith',
        actor: 'Alice Chen',
        status: 'proposed',
        ...(conflicted ? { conflict: { currentValue: 'Jonathan Smith' } } : {}),
      },
    ],
    'patient-phone': [
      {
        id: 'proposal-phone-1',
        proposedValue: '(317) 555-0199',
        baseValue: '(317) 555-0100',
        actor: 'Marcus Lee',
        status: 'proposed',
      },
    ],
  };
}
