import { render, screen } from '@testing-library/react';
import { createFormStore } from '@esheet/core';
import { FormStoreContext } from '@esheet/fields';
import {
  DocumentListFieldProvider,
  useDocumentListFieldHost,
  useDocumentListFieldRuntime,
} from './DocumentListGrid.js';
import type { DocumentListDocument } from './types.js';

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
});
