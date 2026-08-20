export interface DocumentListDocument {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly subject: string;
  readonly docType: string;
  readonly docId: string;
  readonly source: string;
  readonly file: string;
  /**
   * Content hash and byte length, when the host's repository records them.
   * eSheet never computes these — it carries them so a host that stores the
   * bytes elsewhere can address them from the row alone.
   */
  readonly sha256?: string;
  readonly size?: number;
}

export interface DocumentListValue {
  readonly documents: readonly DocumentListDocument[];
}

export const DOCUMENT_LIST_ACTIONS = [
  'view',
  'compose',
  'edit',
  'requestSignature',
  'delete',
  'downloadPdf',
] as const;

export type DocumentListAction = (typeof DOCUMENT_LIST_ACTIONS)[number];

export interface DocumentListInput {
  readonly id?: unknown;
  readonly date?: unknown;
  readonly title?: unknown;
  readonly subject?: unknown;
  readonly docType?: unknown;
  readonly docId?: unknown;
  readonly source?: unknown;
  readonly from?: unknown;
  readonly author?: unknown;
  readonly file?: unknown;
  readonly sha256?: unknown;
  readonly size?: unknown;
}

export interface DocumentListDefinition {
  readonly question?: unknown;
  readonly documents?: unknown;
}
