import React from 'react';
import type {
  AttachmentAnswer,
  FileInput,
  FileReference,
  FileStore,
} from '@esheet/core';
import type { FieldProvider } from './FieldProviders.js';

const FileStoreContext = React.createContext<FileStore | undefined>(undefined);

export interface FileStoreProviderProps {
  readonly store: FileStore;
  readonly children: React.ReactNode;
}

export function FileStoreProvider({
  store,
  children,
}: FileStoreProviderProps): React.JSX.Element {
  return (
    <FileStoreContext.Provider value={store}>
      {children}
    </FileStoreContext.Provider>
  );
}

export function createFileStoreProvider(store: FileStore): FieldProvider {
  return (children) => (
    <FileStoreProvider store={store}>{children}</FileStoreProvider>
  );
}

export function useFileStore(): FileStore | undefined {
  return React.useContext(FileStoreContext);
}

export async function storeFiles(
  store: FileStore,
  files: readonly FileInput[]
): Promise<AttachmentAnswer[]> {
  return Promise.all(
    files.map(async (file) => {
      const fileReference = await store.store(file);
      return {
        contentType: fileReference.contentType,
        fileReference,
        title: fileReference.title,
        size: fileReference.size,
      };
    })
  );
}

const storedReference = (
  attachment: AttachmentAnswer
): FileReference | undefined => attachment.fileReference;

export function removeUnreferencedFiles(
  store: FileStore | undefined,
  before: readonly AttachmentAnswer[],
  after: readonly AttachmentAnswer[]
): void {
  if (!store) return;
  const kept = new Set(
    after.flatMap((attachment) => {
      const reference = storedReference(attachment);
      return reference ? [reference.id] : [];
    })
  );
  for (const attachment of before) {
    const reference = storedReference(attachment);
    if (!reference || kept.has(reference.id)) continue;
    void store.remove(reference).catch(() => undefined);
  }
}