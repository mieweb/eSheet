// ---------------------------------------------------------------------------
// Notes helpers — GUID-keyed merge and attachment traversal
// ---------------------------------------------------------------------------

import type { AttachmentAnswer, FieldResponse, NoteEntry } from '../types.js';

/** Timestamp used for conflict resolution: last edit wins, else creation. */
function noteMergeStamp(note: NoteEntry): string {
  return note.updatedAt ?? note.createdAt;
}

/**
 * Merge two GUID-keyed entry arrays as a set: union by `id`, same-id
 * conflicts resolve last-writer-wins on `stamp`, output sorted by `sortKey`
 * (ties broken by id for determinism). Shared by notes and activity logs.
 */
export function mergeById<T extends { id: string }>(
  a: T[] | undefined,
  b: T[] | undefined,
  stamp: (entry: T) => string,
  sortKey: (entry: T) => string
): T[] {
  const byId = new Map<string, T>();
  for (const entry of a ?? []) {
    byId.set(entry.id, entry);
  }
  for (const entry of b ?? []) {
    const existing = byId.get(entry.id);
    if (!existing || stamp(entry) >= stamp(existing)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort(
    (x, y) => sortKey(x).localeCompare(sortKey(y)) || x.id.localeCompare(y.id)
  );
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
  return mergeById(a, b, noteMergeStamp, (note) => note.createdAt);
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
