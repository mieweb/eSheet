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
  /**
   * Markdown carried on the row itself, for document types the field marks
   * `inline`. The repository is never asked for these bytes: the answer *is*
   * the document, so a host binding the answer to a CRDT gets collaborative
   * prose for free. `file` still names it, for hosts that later export.
   */
  readonly body?: string;
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
  readonly body?: unknown;
}

/** The workflows a field's toolbar offers. */
export const DOCUMENT_LIST_WORKFLOWS = ['compose', 'upload'] as const;

export type DocumentListWorkflow = (typeof DOCUMENT_LIST_WORKFLOWS)[number];

/**
 * `full` owns the viewport and is modal; `docked` is a strip the user can read
 * the rest of the form around. Collapsing never unmounts the panel.
 */
export type DocumentListWorkflowMode = 'full' | 'docked';

/** What the user has typed so far — the part of a draft worth surviving. */
export interface DocumentListComposeDraft {
  readonly title: string;
  readonly subject: string;
  readonly docType: string;
  readonly note: string;
}

/** A document type the compose form offers, instead of free text. */
export interface DocumentListDocTypeOption {
  readonly id: string;
  readonly label?: string;
  /**
   * Keep this type's content on the row (`body`) rather than in the repository.
   * Overrides the field's `inline`, so a mixed list can opt one type either way.
   */
  readonly inline?: boolean;
}

export interface DocumentListDefinition {
  readonly question?: unknown;
  readonly documents?: unknown;
  /**
   * Which toolbar workflows this field offers — both when unset. A list that
   * is only ever composed (case notes) says `['compose']` and grows no upload
   * button.
   */
  readonly workflows?: readonly DocumentListWorkflow[];
  /**
   * What one row is called, lowercase, so the same field reads as "Compose
   * note", "Compose letter", or the default "Compose document".
   */
  readonly noun?: string;
  /** Document types the compose form offers; free text when unset. */
  readonly docTypes?: readonly DocumentListDocTypeOption[];
  /**
   * Compose inline by default, so every type keeps its prose on the row. Only
   * composed prose is affected — uploaded bytes always go to the repository.
   */
  readonly inline?: boolean;
  /** `accept` for the upload file input. */
  readonly accept?: string;
  /** Largest upload accepted, in bytes. */
  readonly maxFileSize?: number;
  /** Which columns to show, in order, by field name; all when unset. */
  readonly columns?: readonly string[];
}
