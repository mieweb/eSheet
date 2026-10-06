import { act, render, screen } from '@testing-library/react';
import type { FieldComponentProps } from '@esheet/core';
import type {
  AllergyManagerProps,
  MedicationReconciliationProps,
} from '@mieweb/ui';
import {
  AllergyListField,
  CodeLookup,
  MedicationListField,
  registerHealthFieldTypes,
} from './index.js';

const codeLookup = {
  component: () => null,
  indexUrl: '/codify',
};

const mocks = vi.hoisted(() => ({
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

describe('CodeLookup worker', () => {
  class WorkerMock {
    static instances: WorkerMock[] = [];
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor(
      readonly url: string | URL,
      readonly options?: WorkerOptions
    ) {
      WorkerMock.instances.push(this);
    }
  }

  beforeEach(() => {
    WorkerMock.instances = [];
    vi.stubGlobal('Worker', WorkerMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the emitted worker beneath a host asset base', () => {
    render(
      <CodeLookup
        indexUrl="/ecase/codify"
        workerUrl="/ecase/assets/codify.worker-test.js"
      />
    );

    const worker = WorkerMock.instances[0];
    expect(new URL(worker.url).pathname).toBe(
      '/ecase/assets/codify.worker-test.js'
    );
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'load',
        baseUrl: '/ecase/codify/en',
      })
    );
  });

  it('reports a worker load failure instead of remaining at zero percent', () => {
    render(<CodeLookup indexUrl="/ecase/codify" />);

    act(() => {
      WorkerMock.instances[0].onerror?.(
        new ErrorEvent('error', { message: 'worker: HTTP 404' })
      );
    });

    expect(screen.getByPlaceholderText('Code index unavailable')).toBeTruthy();
  });
});

describe('field-health', () => {
  it('registers both health field types', () => {
    registerHealthFieldTypes({ indexUrl: '/codify' });

    expect(mocks.registerCustomFieldTypes).toHaveBeenCalledTimes(2);
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
});
