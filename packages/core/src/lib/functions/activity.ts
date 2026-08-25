// ---------------------------------------------------------------------------
// Activity log — append-only response change log (activity page type)
// ---------------------------------------------------------------------------

import type {
  ActivityEntry,
  FieldResponseMap,
  SelectedOption,
} from '../types.js';
import type { NormalizedDefinition } from './normalize.js';
import { extractResponseValue } from './normalize-responses.js';
import { mergeById } from './notes.js';

/** Reserved response key holding the activity log. */
export const ACTIVITY_RESPONSE_KEY = '_activity';

/**
 * Consecutive changes to the same field within this window collapse into the
 * last log entry (so keystrokes don't flood the log).
 */
export const ACTIVITY_DEBOUNCE_MS = 2000;

/**
 * Merge two activity logs as a set keyed by entry GUID (same semantics as
 * `mergeNotes`); output sorted by `at`.
 */
export function mergeActivity(
  a: ActivityEntry[] | undefined,
  b: ActivityEntry[] | undefined
): ActivityEntry[] {
  return mergeById(
    a,
    b,
    (entry) => entry.at,
    (entry) => entry.at
  );
}

/** `N entry`/`N entries`, the log's display for any structured collection. */
function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

/**
 * Custom fields round-trip whole JSON documents as one string answer; the
 * log summarizes them instead of dumping the JSON. `undefined` when the
 * string is not JSON-shaped.
 */
function summarizeJsonAnswer(answer: string): string | undefined {
  const trimmed = answer.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return countLabel(parsed.length);
    if (parsed && typeof parsed === 'object') {
      const list = Object.values(parsed).find(Array.isArray);
      if (list) return countLabel(list.length);
      return 'updated';
    }
  } catch {
    // Not JSON after all — fall through to the raw string.
  }
  return undefined;
}

/** Display form of a response value for the activity log. */
export function formatActivityValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    if (value === '') return undefined;
    return summarizeJsonAnswer(value) ?? value;
  }
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    if (value.every((v) => typeof v === 'object' && v !== null && 'value' in v))
      return (value as SelectedOption[]).map((v) => v.value).join(', ');
    return countLabel(value.length);
  }
  if (typeof value === 'object') {
    if ('value' in value) return String((value as SelectedOption).value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Record a response change into the reserved `_activity` log.
 *
 * No-op (returns `next` unchanged) when the form has no `activity` field,
 * when the changed field IS the log, or when the display value did not
 * change. Consecutive changes to the same field within
 * `ACTIVITY_DEBOUNCE_MS` update the last entry's `to`/`at` in place
 * (keeping the original `from`) instead of appending.
 */
export function recordActivity(
  state: {
    normalized: NormalizedDefinition;
    responses: FieldResponseMap;
    identity?: { name: string };
  },
  fieldId: string,
  next: FieldResponseMap,
  nowIso: string = new Date().toISOString()
): FieldResponseMap {
  if (fieldId === ACTIVITY_RESPONSE_KEY) return next;

  const hasActivityField = Object.values(state.normalized.byId).some(
    (node) => node.definition.fieldType === 'activity'
  );
  if (!hasActivityField) return next;

  // Change detection is on the raw values: two edits of a summarized JSON
  // answer can share a display ("2 entries") yet still be a real change.
  const rawFrom = extractResponseValue(state.responses[fieldId]);
  const rawTo = extractResponseValue(next[fieldId]);
  if (JSON.stringify(rawFrom ?? null) === JSON.stringify(rawTo ?? null))
    return next;

  const from = formatActivityValue(rawFrom);
  let to = formatActivityValue(rawTo);
  // An edit whose summary didn't move still deserves a line — but not
  // "2 entries → 2 entries".
  const sameDisplay = from !== undefined && from === to;
  if (sameDisplay) to = `${to} (edited)`;

  const question = (
    state.normalized.byId[fieldId]?.definition as { question?: string }
  )?.question;

  const log = next[ACTIVITY_RESPONSE_KEY]?.activity ?? [];
  const last = log[log.length - 1];
  const withinDebounce =
    last !== undefined &&
    last.fieldId === fieldId &&
    Date.parse(nowIso) - Date.parse(last.at) < ACTIVITY_DEBOUNCE_MS;

  const nextLog = withinDebounce
    ? [...log.slice(0, -1), { ...last, to, at: nowIso }]
    : [
        ...log,
        {
          id: crypto.randomUUID(),
          at: nowIso,
          ...(state.identity?.name ? { author: state.identity.name } : {}),
          fieldId,
          ...(question !== undefined ? { question } : {}),
          // A same-display edit reads as one statement, not "x → x".
          ...(from !== undefined && !sameDisplay ? { from } : {}),
          ...(to !== undefined ? { to } : {}),
        },
      ];

  return {
    ...next,
    [ACTIVITY_RESPONSE_KEY]: {
      ...next[ACTIVITY_RESPONSE_KEY],
      activity: nextLog,
    },
  };
}
