// ---------------------------------------------------------------------------
// Response Hydration — combine definition + responses into export-ready items
// ---------------------------------------------------------------------------

import type {
  FieldResponse,
  FieldResponseMap,
  ResponseItem,
  SelectedOption,
  RankedAnswer,
  AttachmentAnswer,
  FormResponse,
} from '../types.js';
import type { NormalizedDefinition } from './normalize.js';
import { getFieldTypeMeta } from '../registry.js';
import { isFieldEffectivelyActive } from '../logic/resolve.js';

// ---------------------------------------------------------------------------
// hydrateResponse()
// ---------------------------------------------------------------------------

/**
 * Walk the normalized definition in display order and produce a
 * `FormResponseEnvelope` — one `ResponseItem` per answerable field.
 *
 * - **container** fields (sections) recurse into children but are not emitted.
 * - **display / none** fields (image, html) are skipped entirely.
 * - Unknown field types (no registry entry) are skipped.
 * - **ranking** fields always include their answer, using definition order
 *   when the user has not interacted.
 *
 * @param normalized - The normalized form definition (flat `byId` map).
 * @param responses  - The current form responses.
 * @param options    - Optional envelope metadata.
 */
export function hydrateResponse(
  normalized: NormalizedDefinition,
  responses: FieldResponseMap,
  options?: {
    id?: string;
    definitionId?: string;
    status?: FormResponse['status'];
    subjectRef?: FormResponse['subjectRef'];
  }
): FormResponse {
  const items: ResponseItem[] = [];

  function walk(ids: readonly string[]): void {
    for (const id of ids) {
      const node = normalized.byId[id];
      if (!node) continue;

      const { definition } = node;
      const meta = getFieldTypeMeta(definition.fieldType);
      if (!meta) continue;

      if (!isFieldEffectivelyActive(id, normalized, responses)) continue;

      // Container → recurse into children, don't emit item
      if (meta.answerType === 'container') {
        walk(node.childIds);
        continue;
      }

      // Display / none → skip entirely
      if (meta.answerType === 'display' || meta.answerType === 'none') continue;

      // Ranking: always include, even if the user never dragged
      if (definition.fieldType === 'ranking') {
        const opts = definition.options ?? [];
        const rawSelected = (responses[id]?.selected ?? []) as SelectedOption[];
        const validOrder =
          rawSelected.length === opts.length &&
          rawSelected.every((s) => opts.some((o) => o.id === s.id));
        const orderedOpts = validOrder ? rawSelected : opts;
        const answer: RankedAnswer[] = orderedOpts.map((opt, idx) => ({
          id: opt.id,
          value: opt.value,
          rank: idx + 1,
        }));
        items.push({
          id,
          text:
            (definition as { question?: string }).question ??
            (definition as { title?: string }).title ??
            '',
          answer,
        });
        continue;
      }

      const answer = extractAnswer(responses[id], meta.answerType);
      const item: ResponseItem = {
        id,
        text:
          (definition as { question?: string }).question ??
          (definition as { title?: string }).title ??
          '',
      };
      if (!isEmptyAnswer(answer))
        item.answer = answer as ResponseItem['answer'];
      items.push(item);
    }
  }

  walk(normalized.rootIds);

  return {
    id: options?.id ?? crypto.randomUUID(),
    definitionRef: { id: options?.definitionId ?? '' },
    status: options?.status ?? 'completed',
    subjectRef: options?.subjectRef,
    authoredAt: new Date().toISOString(),
    items,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Returns true when an answer value should be omitted (unanswered). */
function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** Pull the actual answer value out of a FieldResponse based on answer type. */
function extractAnswer(
  response: FieldResponse | undefined,
  answerType: string
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
    case 'media': {
      const dataUrl =
        response.signatureImage ??
        response.signatureData ??
        response.markupImage ??
        response.markupData;
      if (dataUrl) {
        const result: AttachmentAnswer = { contentType: 'image/png', dataUrl };
        return result;
      }
      // File fields store data in fileData with their actual contentType
      return response.fileData;
    }
    default:
      return undefined;
  }
}
