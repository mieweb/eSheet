import type { DocumentListDocument } from './types.js';
import {
  createFormStore,
  type FileInput,
  type FileStore,
  type FormStore,
} from '@esheet/core';
import type {
  DocumentListRepository,
  DocumentListRepositoryContext,
  DocumentListSnapshot,
} from './document-list-runtime.js';
import {
  createDocumentListRuntimeExtension,
  getDocumentListRuntimeState,
} from './document-list-runtime.js';

const context: DocumentListRepositoryContext = {
  formInstanceId: 'form-instance-1',
  fieldId: 'documents',
};

const documentOne: DocumentListDocument = {
  id: 'doc-1',
  date: '2026-08-18',
  title: 'Letter',
  subject: 'Subject',
  docType: 'Letter',
  docId: '42',
  source: 'WebChart',
  file: '42.pdf',
  fileReference: { id: 'file-1', contentType: 'text/plain' },
};

const documentTwo: DocumentListDocument = {
  ...documentOne,
  id: 'doc-2',
  title: 'Second letter',
};

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function createRepository(
  overrides: Partial<DocumentListRepository> = {}
): DocumentListRepository {
  return {
    load: vi.fn(async () => ({ documents: [] })),
    save: vi.fn(async (_context, document) => document),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createFileStore(overrides: Partial<FileStore> = {}): FileStore {
  return {
    store: vi.fn(async (input) => ({
      id: 'stored-file',
      contentType: input.contentType,
      size: input.size,
    })),
    load: vi.fn(async () => ({
      content: 'Document content',
      contentType: 'text/plain',
    })),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createRuntime(
  options: {
    context?: DocumentListRepositoryContext;
    repository?: DocumentListRepository;
    fileStore?: FileStore;
    initialDocuments?: readonly DocumentListDocument[];
    onDocumentsChange?: (documents: readonly DocumentListDocument[]) => void;
  } = {}
): {
  formStore: FormStore;
  getState: () => NonNullable<ReturnType<typeof getDocumentListRuntimeState>>;
} {
  const formStore = createFormStore();
  const runtimeContext = options.context ?? context;
  createDocumentListRuntimeExtension({
    formStore,
    context: runtimeContext,
    repository: options.repository,
    fileStore: options.fileStore,
    initialDocuments: options.initialDocuments,
    onDocumentsChange: options.onDocumentsChange,
  });
  return {
    formStore,
    getState: () => {
      const state = getDocumentListRuntimeState(
        formStore,
        runtimeContext.fieldId
      );
      if (!state) throw new Error('Document-list extension was not registered');
      return state;
    },
  };
}

describe('document list runtime store', () => {
  it('keeps document state isolated between store instances', () => {
    const first = createRuntime({
      initialDocuments: [documentOne],
    });
    const second = createRuntime({
      context: { ...context, formInstanceId: 'form-instance-2' },
    });

    first.getState().upsertDocument(documentTwo);

    expect(first.getState().documentIds).toEqual(['doc-1', 'doc-2']);
    expect(second.getState().documentIds).toEqual([]);
    expect(second.getState().documents['doc-2']).toBeUndefined();
  });

  it('hydrates snapshots, refreshes, and receives subscribed snapshots', async () => {
    let notify: ((snapshot: DocumentListSnapshot) => void) | undefined;
    const unsubscribe = vi.fn();
    const repository = createRepository({
      load: vi.fn(async () => ({
        documents: [documentTwo],
        revision: 'revision-2',
      })),
      subscribe: vi.fn((_context, onSnapshot) => {
        notify = onSnapshot;
        return unsubscribe;
      }),
    });
    const store = createRuntime({ context, repository });

    store.getState().start();
    notify?.({ documents: [documentOne], revision: 'revision-1' });
    expect(store.getState().documents['doc-1']).toEqual(documentOne);

    await store.getState().refresh();

    expect(repository.load).toHaveBeenCalledWith(
      context,
      expect.any(AbortSignal)
    );
    expect(store.getState().documentIds).toEqual(['doc-2']);
    expect(store.getState().revision).toBe('revision-2');

    store.getState().dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(getDocumentListRuntimeState(store.formStore, context.fieldId)).toBe(
      undefined
    );
  });

  it('keeps concurrent saves independent and clears their pending state', async () => {
    const saves = new Map<
      string,
      ReturnType<typeof deferred<DocumentListDocument>>
    >();
    const repository = createRepository({
      save: vi.fn((_context, document) => {
        const request = deferred<DocumentListDocument>();
        saves.set(document.id, request);
        return request.promise;
      }),
    });
    const store = createRuntime({ context, repository });

    const firstSave = store.getState().saveDocument(documentOne);
    const secondSave = store.getState().saveDocument(documentTwo);
    saves.get('doc-1')?.resolve(documentOne);
    saves.get('doc-2')?.resolve(documentTwo);

    await Promise.all([firstSave, secondSave]);

    expect(store.getState().pendingOperations).toEqual({});
    expect(store.getState().syncStatus).toBe('idle');
    expect(store.getState().documentIds).toEqual(['doc-1', 'doc-2']);
  });

  it('saves file-backed metadata without storing new content', async () => {
    const repository = createRepository();
    const onDocumentsChange = vi.fn();
    const store = createRuntime({ repository, onDocumentsChange });

    await store.getState().saveDocument(documentOne);

    expect(repository.save).toHaveBeenCalledWith(
      context,
      documentOne,
      expect.any(AbortSignal)
    );
    expect(onDocumentsChange).toHaveBeenCalledWith([documentOne]);
  });

  it('publishes the row list when a document is removed', async () => {
    const onDocumentsChange = vi.fn();
    const store = createRuntime({
      initialDocuments: [documentOne, documentTwo],
      onDocumentsChange,
    });

    await store.getState().removeDocument('doc-1');

    expect(onDocumentsChange).toHaveBeenCalledWith([documentTwo]);
  });

  it('stores content before saving file reference metadata', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    const store = createRuntime({ repository, fileStore });
    const content: FileInput = {
      content: 'A composed note',
      contentType: 'text/plain',
      size: 15,
    };

    await store.getState().saveDocument(documentOne, content);

    expect(fileStore.store).toHaveBeenCalledWith(content);
    expect(repository.save).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        id: documentOne.id,
        fileReference: {
          id: 'stored-file',
          contentType: 'text/plain',
          size: 15,
        },
      }),
      expect.any(AbortSignal)
    );
  });

  it('rolls back an optimistic delete when the repository fails', async () => {
    const repository = createRepository({
      remove: vi.fn(async () => {
        throw new Error('delete failed');
      }),
    });
    const store = createRuntime({
      repository,
      initialDocuments: [documentOne],
    });

    await expect(
      store.getState().removeDocument(documentOne.id)
    ).rejects.toThrow('delete failed');

    expect(store.getState().documents[documentOne.id]).toEqual(documentOne);
    expect(store.getState().documentIds).toEqual([documentOne.id]);
    expect(store.getState().pendingOperations).toEqual({});
    expect(store.getState().syncStatus).toBe('error');
  });

  it('deduplicates content requests and caches the loaded result', async () => {
    const contentRequest = deferred<FileInput>();
    const fileStore = createFileStore({
      load: vi.fn(() => contentRequest.promise),
    });
    const store = createRuntime({
      fileStore,
      initialDocuments: [documentOne],
    });

    const firstLoad = store.getState().loadContent(documentOne.id);
    const secondLoad = store.getState().loadContent(documentOne.id);
    expect(fileStore.load).toHaveBeenCalledOnce();

    contentRequest.resolve({ content: 'Loaded once', contentType: 'text/plain' });
    await expect(firstLoad).resolves.toEqual({
      text: 'Loaded once',
      contentType: 'text/plain',
      size: undefined,
    });
    await expect(secondLoad).resolves.toEqual({
      text: 'Loaded once',
      contentType: 'text/plain',
      size: undefined,
    });
    expect(store.getState().contents[documentOne.id]).toEqual({
      status: 'loaded',
      content: {
        text: 'Loaded once',
        contentType: 'text/plain',
        size: undefined,
      },
    });

    await expect(store.getState().loadContent(documentOne.id)).resolves.toEqual(
      {
        text: 'Loaded once',
        contentType: 'text/plain',
        size: undefined,
      }
    );
    expect(fileStore.load).toHaveBeenCalledOnce();
  });

  it('loads historical content from the revision file reference', async () => {
    const historicalReference = {
      id: 'file-0',
      contentType: 'text/plain',
    };
    const fileStore = createFileStore();
    const repository = createRepository({
      listRevisions: vi.fn(async () => [
        {
          rev: 0,
          action: 'create' as const,
          fileReference: historicalReference,
        },
      ]),
    });
    const store = createRuntime({
      repository,
      fileStore,
      initialDocuments: [{ ...documentOne, rev: 1 }],
    });

    await store.getState().loadContent(documentOne.id, 0);

    expect(fileStore.load).toHaveBeenCalledWith(historicalReference);
  });
});
