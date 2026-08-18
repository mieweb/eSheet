export interface DocumentListDocument {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly subject: string;
  readonly docType: string;
  readonly docId: string;
  readonly source: string;
  readonly file: string;
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
}

export interface DocumentListDefinition {
  readonly question?: unknown;
  readonly documents?: unknown;
}
