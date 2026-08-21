import type { FormStore } from '@esheet/core';
import { DOCUMENT_LIST_MARKDOWN_TYPE } from './data.js';
import type { DocumentListDocument } from './types.js';

export const DOCUMENT_LIST_EXTENSION_NAMESPACE = '@esheet/document-list-field';

export interface DocumentListRepositoryContext {
  readonly formInstanceId: string;
  readonly fieldId: string;
}

export interface DocumentListSnapshot {
  readonly documents: readonly DocumentListDocument[];
  readonly revision?: string;
}

export interface DocumentListContent {
  readonly reference?: string;
  readonly text?: string;
  readonly contentType?: string;
  readonly size?: number;
  readonly revision?: string;
}

export interface DocumentListContentInput {
  readonly content: string | Blob;
  readonly contentType?: string;
  readonly size?: number;
}

export interface DocumentListRepository {
  seed?: (
    context: DocumentListRepositoryContext,
    snapshot: DocumentListSnapshot
  ) => void;
  load: (
    context: DocumentListRepositoryContext,
    signal: AbortSignal
  ) => Promise<DocumentListSnapshot>;
  save: (
    context: DocumentListRepositoryContext,
    document: DocumentListDocument,
    signal: AbortSignal,
    content?: DocumentListContentInput
  ) => Promise<DocumentListDocument>;
  remove: (
    context: DocumentListRepositoryContext,
    document: DocumentListDocument,
    signal: AbortSignal
  ) => Promise<void>;
  loadContent: (
    context: DocumentListRepositoryContext,
    document: DocumentListDocument,
    signal: AbortSignal
  ) => Promise<DocumentListContent>;
  subscribe?: (
    context: DocumentListRepositoryContext,
    onSnapshot: (snapshot: DocumentListSnapshot) => void
  ) => () => void;
}

export type DocumentListSyncStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'deleting'
  | 'error';

export type DocumentListContentStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface DocumentListContentState {
  readonly status: DocumentListContentStatus;
  readonly content?: DocumentListContent;
  readonly error?: string;
}

export interface DocumentListPendingOperation {
  readonly type: 'save' | 'delete';
  readonly documentId: string;
}

export interface DocumentListRuntimeState {
  readonly documents: Readonly<Record<string, DocumentListDocument>>;
  readonly documentIds: readonly string[];
  readonly contents: Readonly<Record<string, DocumentListContentState>>;
  readonly pendingOperations: Readonly<
    Record<string, DocumentListPendingOperation>
  >;
  readonly syncStatus: DocumentListSyncStatus;
  readonly error?: string;
  readonly revision?: string;
  readonly disposed: boolean;
  readonly hydrated: boolean;

  hydrateSnapshot: (snapshot: DocumentListSnapshot) => void;
  applyRemoteSnapshot: (snapshot: DocumentListSnapshot) => void;
  upsertDocument: (document: DocumentListDocument) => void;
  saveDocument: (
    document: DocumentListDocument,
    content?: DocumentListContentInput
  ) => Promise<DocumentListDocument>;
  removeDocument: (documentId: string) => Promise<void>;
  loadContent: (documentId: string) => Promise<DocumentListContent | undefined>;
  refresh: () => Promise<void>;
  start: () => void;
  dispose: () => void;
}

export interface CreateDocumentListRuntimeExtensionOptions {
  readonly formStore: FormStore;
  readonly context: DocumentListRepositoryContext;
  readonly repository?: DocumentListRepository;
  readonly initialDocuments?: readonly DocumentListDocument[];
  /**
   * Called whenever the row list changes, so the field can publish it as its
   * answer. Rows are the field's to own; the repository only ever sees bytes.
   */
  readonly onDocumentsChange?: (
    documents: readonly DocumentListDocument[]
  ) => void;
}

interface ContentRequest {
  readonly requestId: number;
  readonly controller: AbortController;
  readonly promise: Promise<DocumentListContent>;
}

function documentMap(
  documents: readonly DocumentListDocument[]
): Readonly<Record<string, DocumentListDocument>> {
  return Object.fromEntries(
    documents.map((document) => [document.id, document])
  );
}

function orderedDocuments(
  documents: readonly DocumentListDocument[]
): DocumentListDocument[] {
  const seen = new Set<string>();
  return documents.filter((document) => {
    if (seen.has(document.id)) return false;
    seen.add(document.id);
    return true;
  });
}

function syncStatusFor(
  pendingOperations: Readonly<Record<string, DocumentListPendingOperation>>
): DocumentListSyncStatus {
  const operations = Object.values(pendingOperations);
  if (operations.some((operation) => operation.type === 'delete'))
    return 'deleting';
  if (operations.some((operation) => operation.type === 'save'))
    return 'saving';
  return 'idle';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The content of a row that carries its own body, with no repository call. */
function inlineContent(body: string): DocumentListContent {
  return {
    text: body,
    contentType: DOCUMENT_LIST_MARKDOWN_TYPE,
    size: body.length,
  };
}

export function getDocumentListRuntimeState(
  formStore: FormStore,
  fieldId: string
): DocumentListRuntimeState | undefined {
  return formStore
    .getState()
    .getExtension<DocumentListRuntimeState>(
      DOCUMENT_LIST_EXTENSION_NAMESPACE,
      fieldId
    );
}

export function createDocumentListRuntimeExtension(
  options: CreateDocumentListRuntimeExtensionOptions
): DocumentListRuntimeState | undefined {
  const { formStore, context, repository, onDocumentsChange } = options;
  const existing = getDocumentListRuntimeState(formStore, context.fieldId);
  if (existing) return existing;

  let nextOperationRequestId = 0;
  let nextContentRequestId = 0;
  let refreshRequestId = 0;
  let refreshController: AbortController | undefined;
  let unsubscribe: (() => void) | undefined;
  let resourcesDisposed = false;
  const operationControllers = new Map<string, AbortController>();
  const operationRequestIds = new Map<string, number>();
  const contentRequests = new Map<string, ContentRequest>();
  const initialDocuments = orderedDocuments(options.initialDocuments ?? []);

  const getState = (): DocumentListRuntimeState | undefined =>
    getDocumentListRuntimeState(formStore, context.fieldId);

  const updateState = (
    updater: (state: DocumentListRuntimeState) => DocumentListRuntimeState
  ): void => {
    const current = getState();
    if (!current || current.disposed) return;
    formStore
      .getState()
      .updateExtension<DocumentListRuntimeState>(
        DOCUMENT_LIST_EXTENSION_NAMESPACE,
        context.fieldId,
        (state) => (state ? updater(state) : current)
      );
  };

  /** Publishes the row list to the field. Never called for inbound snapshots. */
  const notifyDocuments = (): void => {
    if (!onDocumentsChange) return;
    const current = getState();
    if (!current) return;
    onDocumentsChange(
      current.documentIds.flatMap((documentId) => {
        const document = current.documents[documentId];
        return document ? [document] : [];
      })
    );
  };

  const setSnapshot = (snapshot: DocumentListSnapshot): void => {
    const current = getState();
    if (!current) return;
    const documents = orderedDocuments(snapshot.documents);
    const nextIds = new Set(documents.map((document) => document.id));
    const contents = Object.fromEntries(
      Object.entries(current.contents).filter(([documentId]) =>
        nextIds.has(documentId)
      )
    );

    updateState((state) => ({
      ...state,
      documents: documentMap(documents),
      documentIds: documents.map((document) => document.id),
      contents,
      error: undefined,
      hydrated: true,
      revision: snapshot.revision,
      syncStatus: syncStatusFor(state.pendingOperations),
    }));
  };

  const disposeResources = (): void => {
    if (resourcesDisposed) return;
    resourcesDisposed = true;
    refreshController?.abort();
    refreshController = undefined;
    for (const controller of operationControllers.values()) controller.abort();
    for (const request of contentRequests.values()) request.controller.abort();
    operationControllers.clear();
    operationRequestIds.clear();
    contentRequests.clear();
    unsubscribe?.();
    unsubscribe = undefined;
  };

  const state: DocumentListRuntimeState = {
    documents: documentMap(initialDocuments),
    documentIds: initialDocuments.map((document) => document.id),
    contents: {},
    pendingOperations: {},
    syncStatus: 'idle',
    disposed: false,
    hydrated: initialDocuments.length > 0,

    hydrateSnapshot: setSnapshot,

    applyRemoteSnapshot: setSnapshot,

    upsertDocument: (document) => {
      updateState((current) => ({
        ...current,
        documents: { ...current.documents, [document.id]: document },
        documentIds: current.documentIds.includes(document.id)
          ? current.documentIds
          : [...current.documentIds, document.id],
        error: undefined,
      }));
      notifyDocuments();
    },

    saveDocument: async (document, content) => {
      const current = getState();
      if (!current || current.disposed) return document;
      current.upsertDocument(document);
      // No bytes, no host: an inline row's content is already in the answer.
      if (!repository || !content) return document;

      const operationKey = `save:${document.id}`;
      operationControllers.get(operationKey)?.abort();
      const controller = new AbortController();
      operationControllers.set(operationKey, controller);
      const requestId = ++nextOperationRequestId;
      operationRequestIds.set(operationKey, requestId);
      updateState((next) => ({
        ...next,
        pendingOperations: {
          ...next.pendingOperations,
          [document.id]: { type: 'save', documentId: document.id },
        },
        syncStatus: 'saving',
        error: undefined,
      }));

      try {
        const saved = content
          ? await repository.save(context, document, controller.signal, content)
          : await repository.save(context, document, controller.signal);
        if (!getState() || operationRequestIds.get(operationKey) !== requestId)
          return saved;
        getState()?.upsertDocument(saved);
        updateState((next) => {
          const { [document.id]: _completed, ...pendingOperations } =
            next.pendingOperations;
          void _completed;
          return {
            ...next,
            pendingOperations,
            syncStatus: syncStatusFor(pendingOperations),
          };
        });
        return saved;
      } catch (error) {
        if (getState() && operationRequestIds.get(operationKey) === requestId) {
          updateState((next) => {
            const { [document.id]: _failed, ...pendingOperations } =
              next.pendingOperations;
            void _failed;
            return {
              ...next,
              pendingOperations,
              syncStatus: 'error',
              error: errorMessage(error),
            };
          });
        }
        throw error;
      } finally {
        if (operationControllers.get(operationKey) === controller)
          operationControllers.delete(operationKey);
        if (operationRequestIds.get(operationKey) === requestId)
          operationRequestIds.delete(operationKey);
      }
    },

    removeDocument: async (documentId) => {
      const current = getState();
      if (!current || current.disposed) return;
      const previousDocument = current.documents[documentId];
      if (!previousDocument) return;
      const previousIndex = current.documentIds.indexOf(documentId);
      const previousContent = current.contents[documentId];
      updateState((next) => {
        const { [documentId]: _removed, ...documents } = next.documents;
        const { [documentId]: _content, ...contents } = next.contents;
        void _removed;
        void _content;
        return {
          ...next,
          documents,
          documentIds: next.documentIds.filter((id) => id !== documentId),
          contents,
          error: undefined,
        };
      });
      notifyDocuments();
      // An inline row left nothing behind for the repository to delete.
      if (!repository || previousDocument.body != null) return;

      const operationKey = `delete:${documentId}`;
      operationControllers.get(operationKey)?.abort();
      const controller = new AbortController();
      operationControllers.set(operationKey, controller);
      const requestId = ++nextOperationRequestId;
      operationRequestIds.set(operationKey, requestId);
      updateState((next) => ({
        ...next,
        pendingOperations: {
          ...next.pendingOperations,
          [documentId]: { type: 'delete', documentId },
        },
        syncStatus: 'deleting',
        error: undefined,
      }));

      try {
        await repository.remove(context, previousDocument, controller.signal);
        if (!getState() || operationRequestIds.get(operationKey) !== requestId)
          return;
        updateState((next) => {
          const { [documentId]: _completed, ...pendingOperations } =
            next.pendingOperations;
          void _completed;
          return {
            ...next,
            pendingOperations,
            syncStatus: syncStatusFor(pendingOperations),
          };
        });
      } catch (error) {
        if (getState() && operationRequestIds.get(operationKey) === requestId) {
          updateState((next) => {
            const documents = { ...next.documents };
            const documentIds = [...next.documentIds];
            documents[documentId] = previousDocument;
            documentIds.splice(Math.max(0, previousIndex), 0, documentId);
            const { [documentId]: _failed, ...pendingOperations } =
              next.pendingOperations;
            void _failed;
            return {
              ...next,
              documents,
              documentIds,
              ...(previousContent && {
                contents: { ...next.contents, [documentId]: previousContent },
              }),
              pendingOperations,
              syncStatus: 'error',
              error: errorMessage(error),
            };
          });
          notifyDocuments();
        }
        throw error;
      } finally {
        if (operationControllers.get(operationKey) === controller)
          operationControllers.delete(operationKey);
        if (operationRequestIds.get(operationKey) === requestId)
          operationRequestIds.delete(operationKey);
      }
    },

    loadContent: (documentId) => {
      const existing = contentRequests.get(documentId);
      if (existing) return existing.promise;
      const current = getState();
      if (!current) return Promise.resolve(undefined);
      const cached = current.contents[documentId];
      if (cached?.status === 'loaded' && cached.content)
        return Promise.resolve(cached.content);
      // An inline row carries its own content; the repository never saw it.
      const inline = current.documents[documentId]?.body;
      if (inline != null) return Promise.resolve(inlineContent(inline));
      if (current.disposed || !repository) return Promise.resolve(undefined);
      const document = current.documents[documentId];
      if (!document) return Promise.resolve(undefined);

      const controller = new AbortController();
      const requestId = ++nextContentRequestId;
      updateState((next) => ({
        ...next,
        contents: {
          ...next.contents,
          [documentId]: { status: 'loading' },
        },
        error: undefined,
      }));

      const promise = repository
        .loadContent(context, document, controller.signal)
        .then((content) => {
          const request = contentRequests.get(documentId);
          if (request?.requestId === requestId && getState()) {
            updateState((next) => ({
              ...next,
              contents: {
                ...next.contents,
                [documentId]: { status: 'loaded', content },
              },
            }));
          }
          return content;
        })
        .catch((error: unknown) => {
          const request = contentRequests.get(documentId);
          if (request?.requestId === requestId && getState()) {
            updateState((next) => ({
              ...next,
              contents: {
                ...next.contents,
                [documentId]: {
                  status: 'error',
                  error: errorMessage(error),
                },
              },
            }));
          }
          throw error;
        })
        .finally(() => {
          const request = contentRequests.get(documentId);
          if (request?.requestId === requestId)
            contentRequests.delete(documentId);
        });

      contentRequests.set(documentId, { requestId, controller, promise });
      return promise;
    },

    refresh: async () => {
      const current = getState();
      if (!current || current.disposed || !repository) return;
      refreshController?.abort();
      const controller = new AbortController();
      refreshController = controller;
      const requestId = ++refreshRequestId;
      updateState((next) => ({
        ...next,
        syncStatus: 'loading',
        error: undefined,
      }));
      try {
        const snapshot = await repository.load(context, controller.signal);
        if (!getState() || requestId !== refreshRequestId) return;
        setSnapshot(snapshot);
      } catch (error) {
        if (getState() && requestId === refreshRequestId) {
          updateState((next) => ({
            ...next,
            syncStatus: 'error',
            error: errorMessage(error),
          }));
        }
        throw error;
      } finally {
        if (refreshController === controller) refreshController = undefined;
      }
    },

    start: () => {
      if (resourcesDisposed || unsubscribe || !repository?.subscribe) return;
      unsubscribe = repository.subscribe(context, (snapshot) => {
        if (getState()) setSnapshot(snapshot);
      });
    },

    dispose: () => {
      if (!getState()) return;
      formStore
        .getState()
        .clearExtension(DOCUMENT_LIST_EXTENSION_NAMESPACE, context.fieldId);
    },
  };

  repository?.seed?.(context, { documents: initialDocuments });
  const registered = formStore
    .getState()
    .registerExtension(
      DOCUMENT_LIST_EXTENSION_NAMESPACE,
      context.fieldId,
      state,
      { onDispose: disposeResources }
    );
  return registered ? state : getState();
}
