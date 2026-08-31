export interface FileInput {
  readonly content: Blob | string;
  readonly contentType: string;
  readonly title?: string;
  readonly size?: number;
}

export interface FileReference {
  readonly id: string;
  readonly contentType: string;
  readonly title?: string;
  readonly size?: number;
  readonly [key: string]: unknown;
}

/** Host-supplied storage for file bytes kept outside form responses. */
export interface FileStore {
  store(input: FileInput): Promise<FileReference>;
  load(reference: FileReference): Promise<FileInput>;
  remove(reference: FileReference): Promise<void>;
}