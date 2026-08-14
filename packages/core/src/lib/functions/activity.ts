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
  return mergeById(a, b, (entry) => entry.at, (entry) => entry.at);
}

/** Display form of a response value for the activity log. */
export function formatActivityValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value === '' ? undefined : value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    if (value.every((v) => typeof v === 'object' && v !== null && 'value' in v))
      return (value as SelectedOption[]).map((v) => v.value).join(', ');
    return `${value.length} ${value.length === 1 ? 'entry' : 'entries'}`;
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

  const from = formatActivityValue(
    extractResponseValue(state.responses[fieldId])
  );
  const to = formatActivityValue(extractResponseValue(next[fieldId]));
  if (from === to) return next;

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
          ...(from !== undefined ? { from } : {}),
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
