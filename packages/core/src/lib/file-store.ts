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

/** A document a host can offer for attachment (e.g. from an EHR chart). */
export interface DocumentPickerItem {
  readonly id: string;
  readonly title: string;
  readonly contentType?: string;
  readonly date?: string;
  readonly description?: string;
  readonly size?: number;
  /** Small preview image shown beside the row (e.g. one image of a multi-image study). */
  readonly thumbnailUrl?: string;
  /** Hosts may add their own fields; the item is passed back to `DocumentPicker.fetch` unchanged. */
  readonly [key: string]: unknown;
}

export interface DocumentPickerQuery {
  /** Id of the file field asking for a document. */
  readonly fieldId: string;
  /** The field's question text, so hosts can scope results to what is asked for. */
  readonly question?: string;
  /** Free-text filter typed by the user. */
  readonly search?: string;
  /** Comma-separated MIME types the field can use (e.g. "image/png,image/jpeg"); hosts should only offer matches. */
  readonly accept?: string;
}

/** Host-supplied source of documents shown by a file field's "Choose from chart" button. */
export interface DocumentPicker {
  /** Label for the button; defaults to "Choose from chart". */
  readonly label?: string;
  list(query: DocumentPickerQuery): Promise<readonly DocumentPickerItem[]>;
  /** Rejecting with an error named `AbortError` (e.g. the user dismissed a host prompt) is silent. */
  fetch(item: DocumentPickerItem): Promise<FileInput>;
}
