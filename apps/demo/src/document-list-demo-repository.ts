import type {
  DocumentListContent,
  DocumentListContentInput,
  DocumentListDocument,
  DocumentListRepository,
  DocumentListRepositoryContext,
  DocumentListSnapshot,
} from '@esheet/document-list-field';

interface DemoDocumentBucket {
  readonly documents: Map<string, DocumentListDocument>;
  readonly contents: Map<string, DocumentListContentInput>;
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
    contents: new Map(),
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

    save: async (context, document, signal, content) => {
      assertNotAborted(signal);
      const bucket = getBucket(context);
      bucket.documents.set(document.id, document);
      if (content) bucket.contents.set(document.id, content);
      bucket.revision += 1;
      notify(bucket);
      return document;
    },

    remove: async (context, documentId, signal) => {
      assertNotAborted(signal);
      const bucket = getBucket(context);
      bucket.documents.delete(documentId);
      bucket.contents.delete(documentId);
      bucket.revision += 1;
      notify(bucket);
    },

    loadContent: async (
      context,
      document,
      signal
    ): Promise<DocumentListContent> => {
      assertNotAborted(signal);
      const savedContent = getBucket(context).contents.get(document.id);
      if (!savedContent) {
        return { reference: document.file };
      }
      const contentType =
        savedContent.contentType ||
        (typeof savedContent.content === 'string'
          ? 'text/plain'
          : savedContent.content.type || 'application/octet-stream');
      const size =
        savedContent.size ??
        (typeof savedContent.content === 'string'
          ? new Blob([savedContent.content]).size
          : savedContent.content.size);
      if (typeof savedContent.content === 'string') {
        return { text: savedContent.content, contentType, size };
      }
      if (contentType.startsWith('text/')) {
        return {
          text: await savedContent.content.text(),
          contentType,
          size,
        };
      }
      if (contentType.startsWith('image/')) {
        const reference = URL.createObjectURL(savedContent.content);
        return { reference, contentType, size };
      }
      return {
        reference: document.file,
        contentType,
        size,
      };
    },

    subscribe: (context, onSnapshot) => {
      const bucket = getBucket(context);
      bucket.listeners.add(onSnapshot);
      return () => bucket.listeners.delete(onSnapshot);
    },
  };
}
