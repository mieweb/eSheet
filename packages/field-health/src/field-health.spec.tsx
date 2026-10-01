import { render } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import type {
  AllergyManagerProps,
  AssessmentProps,
  MedicationReconciliationProps,
} from '@mieweb/ui';
import {
  AllergyListField,
  AssessmentPlanField,
  CodeLookup,
  MedicationListField,
  registerHealthFieldTypes,
} from './index.js';

const codeLookup = {
  component: () => null,
  indexUrl: '/codify',
};

const mocks = vi.hoisted(() => ({
  assessment: vi.fn<(props: AssessmentProps) => React.ReactNode>(() => null),
  allergyManager: vi.fn<(props: AllergyManagerProps) => React.ReactNode>(
    () => null
  ),
  medicationReconciliation: vi.fn<
    (props: MedicationReconciliationProps) => React.ReactNode
  >(() => null),
  registerCustomFieldTypes: vi.fn(),
}));

vi.mock('@mieweb/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mieweb/ui')>()),
  AllergyManager: mocks.allergyManager,
  Assessment: mocks.assessment,
  MedicationEditor: vi.fn(() => null),
  MedicationReconciliation: mocks.medicationReconciliation,
}));

vi.mock('@esheet/fields', () => ({
  registerCustomFieldTypes: mocks.registerCustomFieldTypes,
}));

function createProps(
  definition: Record<string, unknown>,
  response?: FieldComponentProps['response']
): FieldComponentProps {
  return {
    field: { definition },
    response,
    isPreview: true,
    isEnabled: true,
    onResponse: vi.fn(),
  } as unknown as FieldComponentProps;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('field-health', () => {
  it('registers the health field types', () => {
    registerHealthFieldTypes({ indexUrl: '/codify' });

    expect(mocks.registerCustomFieldTypes).toHaveBeenCalledTimes(3);
    expect(mocks.registerCustomFieldTypes).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ medicationList: expect.any(Object) })
    );
    expect(mocks.registerCustomFieldTypes).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ allergyList: expect.any(Object) })
    );

    const medicationField =
      mocks.registerCustomFieldTypes.mock.calls[0][0].medicationList.component;
    render(medicationField(createProps({ question: 'Current medications' })));
    expect(mocks.medicationReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        codeLookup: {
          component: CodeLookup,
          indexUrl: '/codify',
          locale: undefined,
        },
      }),
      undefined
    );
  });

  it('persists medication changes from the reconciliation component', () => {
    const seededMedications = [
      { id: 'seed', name: 'Seed', status: 'taking' as const },
    ];
    const props = createProps({
      question: 'Current medications',
      medications: seededMedications,
    });
    render(<MedicationListField {...props} codeLookup={codeLookup} />);

    const reconciliationProps = mocks.medicationReconciliation.mock.calls[0][0];
    const medications = [
      { id: 'updated', name: 'Aspirin', status: 'taking' as const },
    ];
    reconciliationProps.onChange?.(medications);

    expect(reconciliationProps.medications).toEqual(seededMedications);
    expect(reconciliationProps.title).toBe('Current medications');
    expect(reconciliationProps.codeLookup).toBe(codeLookup);
    expect(reconciliationProps.readOnly).toBe(false);
    expect(props.onResponse).toHaveBeenCalledWith({
      answer: JSON.stringify({ medications }),
    });
  });

  it('uses allergy responses and clears NKA when an allergy is recorded', () => {
    const props = createProps(
      { allergies: [{ id: 'seed', allergen: 'Seed' }] },
      {
        answer: JSON.stringify({
          allergies: [],
          noKnownAllergies: true,
        }),
      }
    );
    render(<AllergyListField {...props} codeLookup={codeLookup} />);

    const managerProps = mocks.allergyManager.mock.calls[0][0];
    expect(managerProps.allergies).toEqual([]);
    expect(managerProps.noKnownAllergies).toBe(true);
    expect(managerProps.codeLookup).toBe(codeLookup);
    expect(managerProps.inlineAddSearch).toBe(true);

    managerProps.onChange?.([
      { id: 'allergy-1', allergen: 'Penicillin', type: 'drug' },
    ]);

    expect(props.onResponse).toHaveBeenCalledWith({
      answer: JSON.stringify({
        allergies: [{ id: 'allergy-1', allergen: 'Penicillin', type: 'drug' }],
      }),
    });
  });

  it('shows the plan by default and can be limited to the assessment', () => {
    const props = createProps({});
    const { rerender } = render(
      <AssessmentPlanField {...props} codeLookup={codeLookup} />
    );
    let assessmentProps = mocks.assessment.mock.calls[0][0];
    expect(assessmentProps.showPlan).toBe(true);
    expect(assessmentProps.onAddOrder).toBeDefined();
    expect(assessmentProps.title).toBe('Assessment & Plan');

    rerender(
      <AssessmentPlanField
        {...createProps({ showPlan: false })}
        codeLookup={codeLookup}
      />
    );
    assessmentProps = mocks.assessment.mock.calls[1][0];
    expect(assessmentProps.showPlan).toBe(false);
    expect(assessmentProps.onAddOrder).toBeUndefined();
    expect(assessmentProps.title).toBe('Assessment');
  });

  it('requires coded assessments when requireCoding is set', () => {
    const props = createProps({ requireCoding: true });
    render(<AssessmentPlanField {...props} codeLookup={codeLookup} />);
    const assessmentProps = mocks.assessment.mock.calls[0][0];
    expect(assessmentProps.billableOnly).toBe(true);

    assessmentProps.onAddAssessment?.({ label: 'Free text' });
    expect(props.onResponse).not.toHaveBeenCalled();

    assessmentProps.onAddAssessment?.({
      label: 'Type 2 diabetes',
      code: { fullid: 'a', codetype: 'ICD-10-CM', fullcode: 'E11.9' },
    });
    const answer = JSON.parse(
      (props.onResponse as ReturnType<typeof vi.fn>).mock.calls[0][0].answer
    );
    expect(answer.items).toHaveLength(1);
    expect(answer.concerns[0].assertions[0].coding[0].code).toBe('E11.9');
  });
});
