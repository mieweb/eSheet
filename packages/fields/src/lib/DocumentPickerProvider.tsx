import React from 'react';
import type { DocumentPicker } from '@esheet/core';
import type { FieldProvider } from './FieldProviders.js';

const DocumentPickerContext = React.createContext<DocumentPicker | undefined>(
  undefined
);

export interface DocumentPickerProviderProps {
  readonly picker: DocumentPicker;
  readonly children: React.ReactNode;
}

export function DocumentPickerProvider({
  picker,
  children,
}: DocumentPickerProviderProps): React.JSX.Element {
  return (
    <DocumentPickerContext.Provider value={picker}>
      {children}
    </DocumentPickerContext.Provider>
  );
}

export function createDocumentPickerProvider(
  picker: DocumentPicker
): FieldProvider {
  return (children) => (
    <DocumentPickerProvider picker={picker}>{children}</DocumentPickerProvider>
  );
}

export function useDocumentPicker(): DocumentPicker | undefined {
  return React.useContext(DocumentPickerContext);
}
