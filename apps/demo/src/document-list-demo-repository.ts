import type { FileInput, FileReference, FileStore } from '@esheet/core';
import type {
  DocumentListDocument,
  DocumentListRepository,
  DocumentListRepositoryContext,
  DocumentListSnapshot,
} from '@esheet/fields-documents';

interface DemoDocumentBucket {
  readonly documents: Map<string, DocumentListDocument>;
  readonly listeners: Set<(snapshot: DocumentListSnapshot) => void>;
  revision: number;
  seeded: boolean;
}

function bucketKey(context: DocumentListRepositoryContext): string {
  return `${context.formInstanceId}:${context.fieldId}`;
}

function createBucket(): DemoDocumentBucket {
  return {
    documents: new Map(),
    listeners: new Set(),
    revision: 0,
    seeded: false,
  };
}

export function createDemoFileStore(): FileStore {
  const files = new Map<string, FileInput>();

  return {
    store: async (input) => {
      const id = globalThis.crypto.randomUUID();
      files.set(id, input);
      return {
        id,
        contentType: input.contentType,
        title: input.title,
        size: input.size,
      } satisfies FileReference;
    },
    load: async (reference) => {
      const file = files.get(reference.id);
      if (!file) throw new Error(`File '${reference.id}' was not found.`);
      return file;
    },
    remove: async (reference) => {
      files.delete(reference.id);
    },
  };
}

function snapshot(bucket: DemoDocumentBucket): DocumentListSnapshot {
  return {
    documents: [...bucket.documents.values()],
    revision: String(bucket.revision),
  };
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Operation aborted', 'AbortError');
}

export function createDemoDocumentListRepository(): DocumentListRepository {
  const buckets = new Map<string, DemoDocumentBucket>();

  const getBucket = (
    context: DocumentListRepositoryContext
  ): DemoDocumentBucket => {
    const key = bucketKey(context);
    const existing = buckets.get(key);
    if (existing) return existing;
    const created = createBucket();
    buckets.set(key, created);
    return created;
  };

  const notify = (bucket: DemoDocumentBucket): void => {
    const nextSnapshot = snapshot(bucket);
    for (const listener of bucket.listeners) listener(nextSnapshot);
  };

  return {
    seed: (context, initialSnapshot) => {
      const bucket = getBucket(context);
      if (bucket.seeded) return;
      for (const document of initialSnapshot.documents)
        bucket.documents.set(document.id, document);
      bucket.seeded = true;
    },

    load: async (context, signal) => {
      assertNotAborted(signal);
      return snapshot(getBucket(context));
    },

    save: async (context, document, signal) => {
      assertNotAborted(signal);
      const bucket = getBucket(context);
      bucket.documents.set(document.id, document);
      bucket.revision += 1;
      notify(bucket);
      return document;
    },

    remove: async (context, document, signal) => {
      assertNotAborted(signal);
      const bucket = getBucket(context);
      bucket.documents.delete(document.id);
      bucket.revision += 1;
      notify(bucket);
    },

    subscribe: (context, onSnapshot) => {
      const bucket = getBucket(context);
      bucket.listeners.add(onSnapshot);
      return () => bucket.listeners.delete(onSnapshot);
    },
  };
}
