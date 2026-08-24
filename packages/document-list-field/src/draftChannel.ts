/**
 * ED.36 — the draft channel: where a proposed change lives.
 *
 * A draft is a proposed change to one document — collaborative, transient,
 * and **never a version**. It lives in one Yjs subdocument per document id:
 * an `XmlFragment` for the body (what `RichEditor`'s `collab` prop speaks — a
 * room name, not a fragment object), a map of definition-tier answers, and a
 * map of draft metadata. Keeping drafts in subdocuments keeps abandoned ones
 * out of the case doc's hot path, and a draft loads only when someone edits.
 *
 * This package must not import Yjs, so the channel is host-supplied — the
 * same pattern as `renderTemplate` (ED.33). The host owns rooms, providers,
 * persistence and awareness; the field sees only this contract. Everything
 * here is advisory UI state: the grants that admit someone to a draft are
 * enforced by the host's capability object (PM.6) and its server (PM.13).
 */
import type { DocumentListAuthor } from './types.js';

/** How the body editor joins the draft: `RichEditor`'s collab room config. */
export interface DraftBodyRoom {
  /** Room id, unique per (case, document) — e.g. `draft/case-1:doc-2`. */
  readonly room: string;
  /** WebSocket base the host's relay listens on; provider default otherwise. */
  readonly wsUrl?: string;
  /** Extra query params for the socket (auth token, role, …). */
  readonly params?: Readonly<Record<string, string>>;
  /** Who this editor is — named, coloured cursors for everyone else. */
  readonly user?: { readonly name: string; readonly color?: string };
}

/** What a draft says about itself — set at open, constant until discarded. */
export interface DraftMeta {
  readonly openedBy: DocumentListAuthor;
  /** ISO 8601. */
  readonly openedAt: string;
  /** The head revision this draft proposes to replace (ED.35's `rev`). */
  readonly baseRev: number;
}

/** Who is in the draft right now — names and colours only, never the text. */
export interface DraftPresence {
  readonly user: DocumentListAuthor;
  readonly color?: string;
  /** The definition-tier field they are focused on, when they said. */
  readonly fieldId?: string | null;
}

/** One open draft, as the field sees it. */
export interface DocumentDraft {
  /** True when this open *created* the draft — the opener seeds prefills. */
  readonly isNew: boolean;
  /** The body room the compose editor binds to via its `collab` prop. */
  readonly body: DraftBodyRoom;
  readonly meta: DraftMeta;
  /** Definition-tier answers proposed by the draft (ED.37 binds them). */
  getAnswers(): Readonly<Record<string, unknown>>;
  /** `undefined` deletes the key — a cleared field is a proposal too. */
  setAnswer(fieldId: string, value: unknown): void;
  /** Fires on any remote answers change; returns the unsubscriber. */
  onAnswers(listener: (answers: Readonly<Record<string, unknown>>) => void): () => void;
  /** Live presence in this draft — everyone but me; returns the unsubscriber. */
  onPresence(listener: (present: readonly DraftPresence[]) => void): () => void;
  /**
   * Fires when somebody else discards the draft — e.g. the document was
   * removed while it was open (removal is the stronger statement). The panel
   * tells the author and closes; nothing here saves anything.
   */
  onDiscarded(listener: () => void): () => void;
  /** Tells peers which definition-tier field I am in (`null` = none). */
  publishFocus(fieldId: string | null): void;
  /**
   * Drops the proposal without a trace — there was never a version. The
   * channel tells everyone else in the draft; the host confirms first when
   * others are present.
   */
  discard(): Promise<void>;
  /** Leave without discarding: the draft stays for whoever else has it open. */
  close(): void;
}

/**
 * The host's draft store, one per document-list provider. `open` creates or
 * **joins** — a draft is shared by construction, so opening a document that
 * already has one lands in the existing draft (its `meta` names who opened
 * it first). `presenceOf` is the row-badge feed: it must be cheap and must
 * not load the draft body.
 */
export interface DocumentDraftChannel {
  open(
    documentId: string,
    options: { readonly openedBy: DocumentListAuthor; readonly baseRev: number }
  ): Promise<DocumentDraft>;
  /** Who is in a document's draft, without joining it; [] means no draft. */
  presenceOf(
    documentId: string,
    listener: (present: readonly DraftPresence[]) => void
  ): () => void;
}
