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

describe('authoritative native storage', () => {
  it('caches PDF metadata and bytes until a refreshed native version changes or the field is disposed', async () => {
    let version = 'version-1';
    const request = vi.fn(
      async () =>
        new Response(new Blob(['%PDF-original'], { type: 'application/pdf' }))
    );
    vi.stubGlobal('fetch', request);
    try {
      const read = vi.fn(async () => ({
        reference: '/api/original.pdf',
        contentType: 'application/pdf',
        document: { ...documentOne, nativeVersion: version },
      }));
      const store = createRuntime({
        repository: createRepository({
          ownsField: () => true,
          loadContent: read,
          load: async () => ({
            documents: [{ ...documentOne, nativeVersion: version }],
          }),
        }),
      });
      await store.getState().refresh();
      const first = await store.getState().loadContent(documentOne.id);
      const second = await store.getState().loadContent(documentOne.id);
      expect(second?.blob).toBe(first?.blob);
      expect(read).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledOnce();
      await store.getState().refresh();
      expect((await store.getState().loadContent(documentOne.id))?.blob).toBe(
        first?.blob
      );
      expect(read).toHaveBeenCalledOnce();
      version = 'version-2';
      await store.getState().refresh();
      const changed = await store.getState().loadContent(documentOne.id);
      expect(changed?.blob).not.toBe(first?.blob);
      expect(read).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenCalledTimes(2);
      store.getState().dispose();
      expect(
        getDocumentListRuntimeState(store.formStore, context.fieldId)
      ).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('invalidates cached PDF bytes after a list refresh fails authorization', async () => {
    const request = vi.fn(
      async () => new Response(new Blob(['%PDF-original']))
    );
    vi.stubGlobal('fetch', request);
    try {
      const read = vi
        .fn()
        .mockResolvedValueOnce({
          reference: '/api/file.pdf',
          contentType: 'application/pdf',
          document: { ...documentOne, nativeVersion: 'v1' },
        })
        .mockRejectedValueOnce(new Error('Access denied'));
      const load = vi
        .fn()
        .mockResolvedValueOnce({ documents: [documentOne] })
        .mockRejectedValueOnce(new Error('Access denied'));
      const store = createRuntime({
        repository: createRepository({
          ownsField: () => true,
          loadContent: read,
          load,
        }),
      });
      await store.getState().refresh();
      await store.getState().loadContent(documentOne.id);
      await expect(store.getState().refresh()).rejects.toThrow('Access denied');
      expect(store.getState().contents).toEqual({});
      await expect(
        store.getState().loadContent(documentOne.id)
      ).rejects.toThrow('Access denied');
      expect(request).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('invalidates cached PDF content after saving and removes it when the row disappears', async () => {
    const read = vi.fn(async () => ({
      blob: new Blob(['%PDF-original'], { type: 'application/pdf' }),
      contentType: 'application/pdf',
    }));
    let documents = [documentOne];
    const store = createRuntime({
      repository: createRepository({
        ownsField: () => true,
        load: async () => ({ documents }),
        loadContent: read,
      }),
    });
    await store.getState().refresh();
    const first = await store.getState().loadContent(documentOne.id);
    expect(await store.getState().loadContent(documentOne.id)).toBe(first);
    expect(read).toHaveBeenCalledOnce();

    await store.getState().saveDocument(documentOne);
    expect(store.getState().contents).toEqual({});
    expect(await store.getState().loadContent(documentOne.id)).not.toBe(first);
    expect(read).toHaveBeenCalledTimes(2);

    documents = [];
    await store.getState().refresh();
    expect(store.getState().contents).toEqual({});
    expect(await store.getState().loadContent(documentOne.id)).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not repopulate the cache with an in-flight read of an old version', async () => {
    const pending = deferred<{ blob: Blob; contentType: string }>();
    let version = 'v1';
    const read = vi.fn(() => pending.promise);
    const store = createRuntime({
      repository: createRepository({
        ownsField: () => true,
        load: async () => ({
          documents: [{ ...documentOne, nativeVersion: version }],
        }),
        loadContent: read,
      }),
    });
    await store.getState().refresh();
    const loading = store.getState().loadContent(documentOne.id);
    const aborted = expect(loading).rejects.toMatchObject({
      name: 'AbortError',
    });
    version = 'v2';
    await store.getState().refresh();
    pending.resolve({
      blob: new Blob(['%PDF-old']),
      contentType: 'application/pdf',
    });
    await aborted;
    expect(store.getState().contents).toEqual({});
  });

  it('retains PDF bytes when switching between documents until the field is disposed', async () => {
    const request = vi.fn(
      async () => new Response(new Blob(['%PDF-original']))
    );
    vi.stubGlobal('fetch', request);
    try {
      const store = createRuntime({
        repository: createRepository({
          ownsField: () => true,
          load: async () => ({ documents: [documentOne, documentTwo] }),
          loadContent: async (_context, row) => ({
            reference: `/api/${row.id}.pdf`,
            contentType: 'application/pdf',
            document: { ...row, nativeVersion: 'v1' },
          }),
        }),
      });
      await store.getState().refresh();
      const first = await store.getState().loadContent(documentOne.id);
      const second = await store.getState().loadContent(documentTwo.id);
      expect(
        Object.values(store.getState().contents).filter(
          (entry) => entry.content?.blob
        )
      ).toHaveLength(2);
      expect((await store.getState().loadContent(documentOne.id))?.blob).toBe(
        first?.blob
      );
      expect((await store.getState().loadContent(documentTwo.id))?.blob).toBe(
        second?.blob
      );
      expect(request).toHaveBeenCalledTimes(2);
      store.getState().dispose();
      expect(
        getDocumentListRuntimeState(store.formStore, context.fieldId)
      ).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('passes optional host category callbacks into the field runtime', async () => {
    const category = {
      label: 'Host category',
      hint: 'Where to file',
      placeholder: 'Choose',
      loading: 'Loading',
      empty: 'None available',
      retry: 'Retry',
      saving: 'Saving',
      pending: 'Not saved',
      loadOptions: vi.fn(async () => [{ id: 'GENERAL', label: 'General' }]),
    };
    const getCategory = vi.fn(() => category);
    const store = createRuntime({
      repository: createRepository({ saveCategory: getCategory }),
    });
    expect(getCategory).toHaveBeenCalledWith(context);
    expect(store.getState().saveCategory).toBe(category);
    const signal = new AbortController().signal;
    await store.getState().saveCategory?.loadOptions('letter', signal);
    expect(category.loadOptions).toHaveBeenCalledWith('letter', signal);
    expect(
      createRuntime({ repository: createRepository() }).getState().saveCategory
    ).toBeUndefined();
  });

  it('does not publish saved native content or accept Yjs answer hydration', async () => {
    const publish = vi.fn();
    const repository = createRepository({
      ownsField: () => true,
      persistInline: true,
      load: async () => ({ documents: [documentOne] }),
    });
    const store = createRuntime({
      repository,
      initialDocuments: [documentTwo],
      onDocumentsChange: publish,
    });
    expect(store.getState().documentIds).toEqual([]);
    store.getState().hydrateSnapshot({ documents: [documentTwo] });
    store.getState().applyRemoteSnapshot({ documents: [documentTwo] });
    expect(store.getState().documentIds).toEqual([]);
    await store.getState().refresh();
    expect(store.getState().documentIds).toEqual([documentOne.id]);
    await store
      .getState()
      .saveDocument({ ...documentOne, body: 'Saved only after explicit Save' });
    expect(repository.save).toHaveBeenCalledOnce();
    expect(publish).not.toHaveBeenCalled();
  });

  it('passes composed letter bytes directly to native storage without a legacy upload', async () => {
    const fileStore = createFileStore();
    const repository = createRepository({ ownsField: () => true });
    const publish = vi.fn();
    const store = createRuntime({
      repository,
      fileStore,
      onDocumentsChange: publish,
    });
    const content = {
      content: '---\nresponse: {}\n---\nLetter prose',
      contentType: 'text/markdown',
    };
    await store.getState().saveDocument(documentOne, content);
    expect(repository.save).toHaveBeenCalledWith(
      context,
      documentOne,
      expect.any(AbortSignal),
      content
    );
    expect(fileStore.store).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

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

  it('keeps the existing inline save behavior unless the repository opts in', async () => {
    const repository = createRepository();
    const onDocumentsChange = vi.fn();
    const store = createRuntime({ repository, onDocumentsChange });
    const inline = { ...documentOne, body: 'Saved inline note' };

    await expect(store.getState().saveDocument(inline)).resolves.toEqual(
      inline
    );

    expect(repository.save).not.toHaveBeenCalled();
    expect(onDocumentsChange).toHaveBeenCalledWith([inline]);
  });

  it('publishes only the returned reference after an inline repository save succeeds', async () => {
    const request = deferred<DocumentListDocument>();
    const repository = createRepository({
      persistInline: true,
      save: vi.fn(() => request.promise),
    });
    const onDocumentsChange = vi.fn();
    const fileStore = createFileStore();
    const store = createRuntime({ repository, fileStore, onDocumentsChange });
    const inline = { ...documentOne, body: 'Private until saved' };

    const saving = store.getState().saveDocument(inline);

    expect(repository.save).toHaveBeenCalledWith(
      context,
      inline,
      expect.any(AbortSignal)
    );
    expect(onDocumentsChange).not.toHaveBeenCalled();
    expect(store.getState().documentIds).toEqual([]);
    expect(store.getState().syncStatus).toBe('saving');
    request.resolve(documentOne);
    const canonical = { ...documentOne, inline: true };
    await expect(saving).resolves.toEqual(canonical);

    expect(onDocumentsChange).toHaveBeenCalledExactlyOnceWith([canonical]);
    expect(store.getState().documents[documentOne.id]).toEqual(canonical);
    expect(store.getState().pendingOperations).toEqual({});
    expect(store.getState().syncStatus).toBe('idle');
    expect(fileStore.store).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'does not publish a failed inline save (existing record: %s)',
    async (existing) => {
      const repository = createRepository({
        persistInline: true,
        save: vi.fn(async () => {
          throw new Error('Native save refused');
        }),
      });
      const onDocumentsChange = vi.fn();
      const store = createRuntime({
        repository,
        initialDocuments: existing ? [documentOne] : [],
        onDocumentsChange,
      });

      await expect(
        store.getState().saveDocument({
          ...documentOne,
          body: 'Unsaved changes',
        })
      ).rejects.toThrow('Native save refused');

      expect(onDocumentsChange).not.toHaveBeenCalled();
      expect(store.getState().documents[documentOne.id]).toEqual(
        existing ? documentOne : undefined
      );
      expect(store.getState().pendingOperations).toEqual({});
      expect(store.getState().syncStatus).toBe('error');
      expect(store.getState().error).toBe('Native save refused');
    }
  );

  it('does not publish a superseded inline save that finishes after its replacement', async () => {
    const first = deferred<DocumentListDocument>();
    const second = deferred<DocumentListDocument>();
    const repository = createRepository({
      persistInline: true,
      save: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    });
    const onDocumentsChange = vi.fn();
    const store = createRuntime({ repository, onDocumentsChange });
    const firstSave = store.getState().saveDocument({
      ...documentOne,
      body: 'First',
    });
    const aborted = expect(firstSave).rejects.toMatchObject({
      name: 'AbortError',
    });
    const secondSave = store.getState().saveDocument({
      ...documentOne,
      body: 'Second',
    });
    const latest = {
      ...documentOne,
      title: 'Latest native revision',
      inline: true,
    };
    second.resolve(latest);
    await secondSave;
    first.resolve(documentOne);
    await aborted;

    expect(onDocumentsChange).toHaveBeenCalledExactlyOnceWith([latest]);
    expect(store.getState().documents[documentOne.id]).toEqual(latest);
    expect(store.getState().pendingOperations).toEqual({});
    expect(store.getState().syncStatus).toBe('idle');
  });

  it('does not publish an inline save after disposal even if its backend ignores cancellation', async () => {
    const request = deferred<DocumentListDocument>();
    const repository = createRepository({
      persistInline: true,
      save: vi.fn(() => request.promise),
    });
    const onDocumentsChange = vi.fn();
    const store = createRuntime({ repository, onDocumentsChange });
    const saving = store.getState().saveDocument({
      ...documentOne,
      body: 'Pending note',
    });
    const aborted = expect(saving).rejects.toMatchObject({
      name: 'AbortError',
    });
    store.getState().dispose();
    request.resolve(documentOne);
    await aborted;

    expect(onDocumentsChange).not.toHaveBeenCalled();
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

  it('does not publish a removal when the repository fails', async () => {
    const repository = createRepository({
      remove: vi.fn(async () => {
        throw new Error('delete failed');
      }),
    });
    const onDocumentsChange = vi.fn();
    const store = createRuntime({
      repository,
      initialDocuments: [documentOne],
      onDocumentsChange,
    });

    await expect(
      store.getState().removeDocument(documentOne.id)
    ).rejects.toThrow('delete failed');

    expect(store.getState().documents[documentOne.id]).toEqual(documentOne);
    expect(store.getState().documentIds).toEqual([documentOne.id]);
    expect(store.getState().pendingOperations).toEqual({});
    expect(store.getState().syncStatus).toBe('error');
    expect(onDocumentsChange).not.toHaveBeenCalled();
  });

  it('waits for both original bytes and native association before publishing an upload', async () => {
    const upload = deferred<DocumentListDocument>();
    const onDocumentsChange = vi.fn();
    const repository = createRepository({
      save: vi.fn(() => upload.promise),
    });
    const fileStore = createFileStore();
    const store = createRuntime({
      repository,
      fileStore,
      onDocumentsChange,
    });
    const saving = store.getState().saveDocument(documentOne, {
      content: new Blob([new Uint8Array([0, 255, 13, 10])]),
      contentType: 'application/octet-stream',
    });
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    expect(onDocumentsChange).not.toHaveBeenCalled();
    expect(store.getState().documentIds).toEqual([]);
    upload.resolve(documentOne);
    await saving;
    expect(onDocumentsChange).toHaveBeenCalledExactlyOnceWith([documentOne]);
  });

  it.each(['bytes', 'association'])(
    'does not publish a file save when %s persistence fails',
    async (stage) => {
      const onDocumentsChange = vi.fn();
      const repository = createRepository({
        save: vi.fn(async () => {
          throw new Error('Association refused');
        }),
      });
      const fileStore = createFileStore(
        stage === 'bytes'
          ? {
              store: vi.fn(async () => {
                throw new Error('Upload refused');
              }),
            }
          : {}
      );
      const store = createRuntime({
        repository,
        fileStore,
        initialDocuments: [documentOne],
        onDocumentsChange,
      });
      await expect(
        store
          .getState()
          .saveDocument(
            { ...documentOne, title: 'Uncommitted replacement' },
            { content: 'bytes', contentType: 'text/plain' }
          )
      ).rejects.toThrow(
        stage === 'bytes' ? 'Upload refused' : 'Association refused'
      );
      expect(store.getState().documents[documentOne.id]).toEqual(documentOne);
      expect(onDocumentsChange).not.toHaveBeenCalled();
      expect(store.getState().syncStatus).toBe('error');
    }
  );

  it('asks the authoritative inline repository to remove before publishing', async () => {
    const removal = deferred<void>();
    const repository = createRepository({
      persistInline: true,
      remove: vi.fn(() => removal.promise),
    });
    const onDocumentsChange = vi.fn();
    const inline = { ...documentOne, body: 'Saved native prose' };
    const store = createRuntime({
      repository,
      initialDocuments: [inline],
      onDocumentsChange,
    });
    const removing = store.getState().removeDocument(inline.id);
    expect(repository.remove).toHaveBeenCalledWith(
      context,
      inline,
      expect.any(AbortSignal)
    );
    expect(store.getState().documents[inline.id]).toEqual(inline);
    expect(onDocumentsChange).not.toHaveBeenCalled();
    removal.resolve();
    await removing;
    expect(onDocumentsChange).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('caches canonical text instead of stale inline answers until its version changes', async () => {
    let text = 'Native original';
    let version = 'v1';
    const loadContent = vi.fn(async () => ({
      text,
      contentType: 'text/markdown',
    }));
    const repository = createRepository({
      loadContent,
      load: async () => ({
        documents: [{ ...documentOne, nativeVersion: version }],
      }),
    });
    const store = createRuntime({
      repository,
      initialDocuments: [
        { ...documentOne, nativeVersion: version, body: 'Stale Yjs prose' },
      ],
    });
    expect(await store.getState().loadContent(documentOne.id)).toEqual({
      text: 'Native original',
      contentType: 'text/markdown',
    });
    expect(await store.getState().loadContent(documentOne.id)).toEqual({
      text: 'Native original',
      contentType: 'text/markdown',
    });
    expect(loadContent).toHaveBeenCalledOnce();
    text = 'Native edit';
    version = 'v2';
    await store.getState().refresh();
    expect(await store.getState().loadContent(documentOne.id)).toEqual({
      text: 'Native edit',
      contentType: 'text/markdown',
    });
    expect(loadContent).toHaveBeenCalledTimes(2);
    expect(loadContent).toHaveBeenLastCalledWith(
      context,
      expect.objectContaining({ id: documentOne.id }),
      expect.any(AbortSignal),
      undefined
    );
  });

  it('deduplicates native revision requests and surfaces refused content reads', async () => {
    const request = deferred<{
      text: string;
      contentType: string;
    }>();
    const repository = createRepository({
      loadContent: vi.fn(() => request.promise),
    });
    const store = createRuntime({
      repository,
      initialDocuments: [documentOne],
    });
    const first = store.getState().loadContent(documentOne.id, 0);
    const second = store.getState().loadContent(documentOne.id, 0);
    const refused = Promise.all([
      expect(first).rejects.toThrow('Read forbidden'),
      expect(second).rejects.toThrow('Read forbidden'),
    ]);
    expect(repository.loadContent).toHaveBeenCalledOnce();
    request.reject(new Error('Read forbidden'));
    await refused;
    expect(store.getState().contents[`${documentOne.id}:0`]).toEqual({
      status: 'error',
      error: 'Read forbidden',
    });
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

    contentRequest.resolve({
      content: 'Loaded once',
      contentType: 'text/plain',
    });
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
