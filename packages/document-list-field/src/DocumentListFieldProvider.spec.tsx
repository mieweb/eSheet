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

vi.mock('@kerebron/editor', () => ({
  CoreEditor: {
    create: () => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      view: { setProps: vi.fn() },
      loadDocument: vi.fn(async () => undefined),
      saveDocument: vi.fn(async () => new TextEncoder().encode('')),
      destroy: vi.fn(),
    }),
  },
}));

vi.mock('@kerebron/editor-kits/AdvancedEditorKit', () => ({
  AdvancedEditorKit: class AdvancedEditorKit {},
}));

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
      formStore
        .getState()
        .getExtension('@esheet/document-list-field', 'documents')
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
        .getExtension('@esheet/document-list-field', 'documents')
    ).toBeTruthy();
    expect(
      secondFormStore
        .getState()
        .getExtension('@esheet/document-list-field', 'documents')
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
        <DocumentListFieldProvider host={{}}>
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
    // Portaled out of the renderer, so page scroll and stacking cannot clip it.
    expect(
      screen
        .getByRole('dialog')
        .closest('[data-slot="dockable-panel-dock"]')?.parentElement
    ).toBe(globalThis.document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse to dock' }));

    rerender(tree(false));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Compose document' })).toBeNull()
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Visit note')).toBeTruthy();
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe(
      'Visit note'
    );
  });
});
