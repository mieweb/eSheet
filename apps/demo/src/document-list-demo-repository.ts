import type {
  DocumentListDocument,
  DocumentListRepository,
  DocumentListRepositoryContext,
  DocumentListSnapshot,
} from '@esheet/document-list-field';

interface DemoDocumentBucket {
  readonly documents: Map<string, DocumentListDocument>;
  readonly listeners: Set<(snapshot: DocumentListSnapshot) => void>;
  revision: number;
  seeded: boolean;
}

export interface DemoDocumentListRepository extends DocumentListRepository {
  readonly setFile: (documentId: string, file: File) => void;
}

let nextDemoDocumentId = 1;

function createDemoDocumentId(): string {
  const id = `demo-created-${nextDemoDocumentId}`;
  nextDemoDocumentId += 1;
  return id;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function documentFromUploadedFile(file: File): DocumentListDocument {
  const id = createDemoDocumentId();
  return {
    id,
    date: today(),
    title: file.name,
    subject: 'Uploaded in the eSheet demo',
    docType: file.type || 'Uploaded document',
    docId: id,
    source: 'Demo upload',
    file: file.name,
  };
}

export function createComposedDemoDocument(): DocumentListDocument {
  const id = createDemoDocumentId();
  return {
    id,
    date: today(),
    title: 'Composed demo document',
    subject: 'Created in the eSheet demo',
    docType: 'Demo document',
    docId: id,
    source: 'Demo compose',
    file: `${id}.txt`,
  };
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

function snapshot(bucket: DemoDocumentBucket): DocumentListSnapshot {
  return {
    documents: [...bucket.documents.values()],
    revision: String(bucket.revision),
  };
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Operation aborted', 'AbortError');
}

export function createDemoDocumentListRepository(): DemoDocumentListRepository {
  const buckets = new Map<string, DemoDocumentBucket>();
  const files = new Map<string, File>();

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

    remove: async (context, documentId, signal) => {
      assertNotAborted(signal);
      const bucket = getBucket(context);
      bucket.documents.delete(documentId);
      files.delete(documentId);
      bucket.revision += 1;
      notify(bucket);
    },

    loadContent: async (context, document, signal) => {
      assertNotAborted(signal);
      const file = files.get(document.id);
      if (!file) {
        return { reference: document.file };
      }
      return {
        reference: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      };
    },

    subscribe: (context, onSnapshot) => {
      const bucket = getBucket(context);
      bucket.listeners.add(onSnapshot);
      return () => bucket.listeners.delete(onSnapshot);
    },

    setFile: (documentId, file) => {
      files.set(documentId, file);
    },
  };
}
