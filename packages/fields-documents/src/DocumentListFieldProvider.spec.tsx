import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createFormStore, type FieldComponentProps } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import { DocumentListField } from './DocumentListField.js';
import {
  DocumentListFieldProvider,
  useDocumentListFieldHost,
  useDocumentListFieldRuntime,
} from './DocumentListGrid.js';
import type { DocumentListDocument } from './types.js';
import { permissiveDocumentListCapabilities } from './types.js';

vi.mock('@mieweb/ui/datavis', () => ({
  DataVisNitroContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
  DataVisNitroGrid: (props: Record<string, unknown>) =>
    (props.titleActions as ReactNode) ?? null,
}));

vi.mock('datavis-ace', () => {
  class Source {
    cache: Record<string, unknown> = {};
    constructor(public readonly options: unknown) {}
  }
  class ComputedView {
    constructor(public readonly source: Source) {}
    clearCache(): void {}
    getData(): void {}
  }
  return { ComputedView, Source };
});

vi.mock('@esheet/field-kerebron', async () => {
  const React = await import('react');
  return {
    configureRichTextField: vi.fn(),
    KerebronEditor: React.forwardRef(
      (props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
        const value = props.value as string;
        React.useImperativeHandle(ref, () => ({
          focus: vi.fn(),
          getContent: async () => value,
        }));
        return (
          <div className={props.className as string}>
            <textarea
              aria-label={props.ariaLabel as string}
              disabled={props.disabled as boolean}
              value={value}
              onChange={(event) =>
                (props.onChange as (nextValue: string) => void)(
                  event.target.value
                )
              }
            />
          </div>
        );
      }
    ),
  };
});

function HostProbe(): React.JSX.Element {
  const host = useDocumentListFieldHost();
  return <output>{host?.detailRowsExpanded ? 'expanded' : 'collapsed'}</output>;
}

const document: DocumentListDocument = {
  id: 'doc-1',
  date: '2026-08-18',
  title: 'Letter',
  subject: 'Subject',
  docType: 'Letter',
  docId: '42',
  source: 'WebChart',
  file: '42.pdf',
};

const runtimeStores: unknown[] = [];

function RuntimeProbe({ fieldId }: { fieldId: string }): React.JSX.Element {
  const store = useDocumentListFieldRuntime(fieldId, [document]);
  if (store) runtimeStores.push(store);
  return <output>{store?.documentIds.join(',') ?? 'missing'}</output>;
}

describe('DocumentListFieldProvider', () => {
  beforeEach(() => {
    runtimeStores.length = 0;
  });

  it('makes host controls available without changing the field value', () => {
    render(
      <DocumentListFieldProvider host={{ detailRowsExpanded: true }}>
        <HostProbe />
      </DocumentListFieldProvider>
    );

    expect(screen.getByText('expanded')).toBeTruthy();
  });

  it('returns no host when the field is not wrapped', () => {
    render(<HostProbe />);

    expect(screen.getByText('collapsed')).toBeTruthy();
  });

  it('registers one extension per field in the core form store', () => {
    const formStore = createFormStore();
    const { unmount } = render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider host={{}}>
          <RuntimeProbe fieldId="documents" />
          <RuntimeProbe fieldId="documents" />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    expect(screen.getAllByText('doc-1')).toHaveLength(2);
    expect(runtimeStores[0]).toBe(runtimeStores[1]);
    expect(
      formStore.getState().getExtension('documents', 'documents')
    ).toBeUndefined();
    expect(
      formStore.getState().getExtension('@esheet/fields-documents', 'documents')
    ).toBe(runtimeStores[0]);
    unmount();
  });

  it('isolates extension state between core form stores', () => {
    const firstFormStore = createFormStore();
    const secondFormStore = createFormStore();
    render(
      <>
        <FormStoreContext.Provider value={firstFormStore}>
          <DocumentListFieldProvider host={{}}>
            <RuntimeProbe fieldId="documents" />
          </DocumentListFieldProvider>
        </FormStoreContext.Provider>
        <FormStoreContext.Provider value={secondFormStore}>
          <DocumentListFieldProvider host={{}}>
            <RuntimeProbe fieldId="documents" />
          </DocumentListFieldProvider>
        </FormStoreContext.Provider>
      </>
    );

    expect(screen.getAllByText('doc-1')).toHaveLength(2);
    expect(
      firstFormStore
        .getState()
        .getExtension('@esheet/fields-documents', 'documents')
    ).toBeTruthy();
    expect(
      secondFormStore
        .getState()
        .getExtension('@esheet/fields-documents', 'documents')
    ).toBeTruthy();
  });

  // The reason the composer session is hoisted at all: eSheet's pages
  // navigator unmounts the page the draft was started from.
  it('keeps a docked draft when the field that opened it unmounts', async () => {
    const formStore = createFormStore();
    const field = {
      definition: { id: 'documents', question: 'Documents' },
    } as unknown as FieldComponentProps['field'];
    const fieldProps = {
      field,
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;
    const tree = (visible: boolean): React.JSX.Element => (
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider
          host={{ capabilities: permissiveDocumentListCapabilities }}
        >
          {visible ? <DocumentListField {...fieldProps} /> : null}
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );

    const { rerender } = render(tree(true));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Compose document' })
    );
    // The runtime marks the title required, so the label reads "Title *".
    fireEvent.change(await screen.findByLabelText(/^Title/), {
      target: { value: 'Visit note' },
    });
    expect(globalThis.document.body.contains(screen.getByRole('dialog'))).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse to dock' }));

    rerender(tree(false));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Compose document' })
      ).toBeNull()
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Visit note')).toBeTruthy();
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe(
      'Visit note'
    );
  });
});

describe('capabilities (the host says who may do what)', () => {
  const mountField = (
    host: Parameters<typeof DocumentListFieldProvider>[0]['host'],
    definition: Record<string, unknown> = {
      id: 'documents',
      question: 'Documents',
    }
  ): void => {
    const formStore = createFormStore();
    const fieldProps = {
      field: { definition },
      form: formStore,
      response: undefined,
    } as unknown as FieldComponentProps;
    render(
      <FormStoreContext.Provider value={formStore}>
        <DocumentListFieldProvider host={host}>
          <DocumentListField {...fieldProps} />
        </DocumentListFieldProvider>
      </FormStoreContext.Provider>
    );
  };

  it('a host that says nothing is read-only: no compose, no upload', async () => {
    mountField({});
    expect(await screen.findByLabelText('Documents')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Compose/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Upload/ })).toBeNull();
  });

  it('compose appears only when some offered type is creatable', async () => {
    mountField(
      {
        capabilities: {
          ...permissiveDocumentListCapabilities,
          create: (docType: string) => docType === 'phone-call',
        },
      },
      {
        id: 'documents',
        question: 'Documents',
        docTypes: [{ id: 'progress-note' }, { id: 'phone-call' }],
      }
    );
    expect(
      await screen.findByRole('button', { name: 'Compose document' })
    ).toBeTruthy();
  });

  it('compose disappears when no offered type is creatable', async () => {
    mountField(
      {
        capabilities: {
          ...permissiveDocumentListCapabilities,
          create: () => false,
        },
      },
      {
        id: 'documents',
        question: 'Documents',
        docTypes: [{ id: 'progress-note' }],
      }
    );
    expect(await screen.findByLabelText('Documents')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Compose/ })).toBeNull();
  });
});
