// ---------------------------------------------------------------------------
// AttachmentManager — the seam between a field and wherever bytes really live.
// ---------------------------------------------------------------------------

import type { AttachmentAnswer } from './types.js';

/**
 * Host-supplied storage for attachment bytes.
 *
 * By default eSheet carries whole files inline as base64 data URLs on the
 * response. That is fine for a demo and ruinous for a host that persists the
 * response — base64 costs +33% on every byte, and a CRDT-backed host pays it
 * again on every edit, forever. A host that supplies a manager gets the bytes
 * handed to it and keeps only a reference on the response.
 *
 * The reference is an `AttachmentAnswer` without a `dataUrl`; what identifies
 * it is the host's business, so hosts widen the type with their own fields
 * (a path, a URL, a hash) and eSheet passes them through untouched.
 *
 * All three calls are optional to *use*: when no manager is registered the
 * fields behave exactly as they did before, inline.
 */
export interface AttachmentManager {
  /** Bytes in, reference out. Called before an attachment reaches a response. */
  store(attachment: AttachmentAnswer): Promise<AttachmentAnswer>;
  /** Reference in, bytes back. Called when something needs to render or download. */
  load(attachment: AttachmentAnswer): Promise<AttachmentAnswer>;
  /** The response no longer refers to this attachment. */
  remove(attachment: AttachmentAnswer): Promise<void>;
}
