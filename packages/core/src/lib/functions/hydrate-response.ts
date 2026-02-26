// ---------------------------------------------------------------------------
// Response Hydration — combine definition + responses into export-ready items
// ---------------------------------------------------------------------------

import type { FieldResponse, FormResponse } from '../types.js';
import type { NormalizedDefinition } from './normalize.js';
import { getFieldTypeMeta } from '../registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A hydrated response item — one per answerable field.
 *
 * Joins the question text from the definition with the field's
 * extracted answer value for export / submission.
 */
export interface HydratedResponseItem {
  /** Field ID. */
  id: string;
  /** The question text shown to the user. */
  text: string;
  /** The extracted answer value, or `undefined` when unanswered. */
  answer: unknown;
}

// ---------------------------------------------------------------------------
// hydrateResponse()
// ---------------------------------------------------------------------------

/**
 * Walk the normalized definition in display order and produce a flat
 * array of hydrated response items — one per answerable field.
 *
 * - **container** fields (sections) recurse into children but are not emitted.
 * - **display / none** fields (image, html) are skipped entirely.
 * - Unknown field types (no registry entry) are skipped.
 *
 * @param normalized - The normalized form definition (flat `byId` map).
 * @param responses  - The current form responses.
 */
export function hydrateResponse(
  normalized: NormalizedDefinition,
  responses: FormResponse,
): HydratedResponseItem[] {
  const items: HydratedResponseItem[] = [];

  function walk(ids: readonly string[]): void {
    for (const id of ids) {
      const node = normalized.byId[id];
      if (!node) continue;

      const { definition } = node;
      const meta = getFieldTypeMeta(definition.fieldType);
      if (!meta) continue;

      // Container → recurse into children, don't emit item
      if (meta.answerType === 'container') {
        walk(node.childIds);
        continue;
      }

      // Display / none → skip entirely
      if (meta.answerType === 'display' || meta.answerType === 'none') continue;

      items.push({
        id,
        text: definition.question ?? definition.title ?? '',
        answer: extractAnswer(responses[id], meta.answerType),
      });
    }
  }

  walk(normalized.rootIds);
  return items;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Pull the actual answer value out of a FieldResponse based on answer type. */
function extractAnswer(
  response: FieldResponse | undefined,
  answerType: string,
): unknown {
  if (!response) return undefined;

  switch (answerType) {
    case 'text':
      return response.answer;
    case 'selection':
    case 'multiselection':
    case 'matrix':
      return response.selected;
    case 'multitext':
      return response.multitextAnswers;
    case 'media':
      return response.signatureImage ?? response.signatureData
        ?? response.markupImage ?? response.markupData;
    default:
      return undefined;
  }
}
