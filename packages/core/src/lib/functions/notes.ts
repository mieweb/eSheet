// ---------------------------------------------------------------------------
// Notes helpers — GUID-keyed merge and attachment traversal
// ---------------------------------------------------------------------------

import type {
  AttachmentAnswer,
  FieldResponse,
  NoteEntry,
} from '../types.js';

/** Timestamp used for conflict resolution: last edit wins, else creation. */
function noteMergeStamp(note: NoteEntry): string {
  return note.updatedAt ?? note.createdAt;
}

/**
 * Merge two `notes[]` arrays as a **set keyed by `id`**.
 *
 * - Entries present on only one side are kept (concurrent adds union cleanly
 *   because every entry carries its own GUID).
 * - Same-id conflicts resolve last-writer-wins on `updatedAt ?? createdAt`.
 * - Output is sorted by `createdAt` (ties broken by id for determinism).
 *
 * Hosts with CRDT bindings call this when both sides changed the field
 * instead of letting the whole array be last-writer-wins.
 */
export function mergeNotes(
  a: NoteEntry[] | undefined,
  b: NoteEntry[] | undefined
): NoteEntry[] {
  const byId = new Map<string, NoteEntry>();
  for (const note of a ?? []) {
    byId.set(note.id, note);
  }
  for (const note of b ?? []) {
    const existing = byId.get(note.id);
    if (!existing || noteMergeStamp(note) >= noteMergeStamp(existing)) {
      byId.set(note.id, note);
    }
  }
  return [...byId.values()].sort(
    (x, y) =>
      x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id)
  );
}

/**
 * Every attachment in a response, whatever the field type — covers `fileData`
 * (file fields) and `notes[].attachments` (notes fields). Use this instead of
 * hardcoding `fileData` in externalize/rehydrate pipelines.
 */
export function collectAttachments(
  response: FieldResponse
): AttachmentAnswer[] {
  const result: AttachmentAnswer[] = [];
  if (response.fileData) {
    result.push(
      ...(Array.isArray(response.fileData)
        ? response.fileData
        : [response.fileData])
    );
  }
  for (const note of response.notes ?? []) {
    if (note.attachments) result.push(...note.attachments);
  }
  return result;
}

/**
 * Rewrite every attachment in a response via a mapper, returning a new
 * response (used by externalize/rehydrate pipelines). Responses without
 * attachments are returned unchanged (same reference).
 */
export function mapAttachments(
  response: FieldResponse,
  fn: (attachment: AttachmentAnswer) => AttachmentAnswer
): FieldResponse {
  let changed = false;
  const next: FieldResponse = { ...response };

  if (response.fileData) {
    next.fileData = Array.isArray(response.fileData)
      ? response.fileData.map(fn)
      : fn(response.fileData);
    changed = true;
  }

  if (response.notes?.some((note) => note.attachments?.length)) {
    next.notes = response.notes.map((note) =>
      note.attachments?.length
        ? { ...note, attachments: note.attachments.map(fn) }
        : note
    );
    changed = true;
  }

  return changed ? next : response;
}
