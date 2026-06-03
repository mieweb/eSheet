// ---------------------------------------------------------------------------
// Normalize Responses — extract raw values from FieldResponseMap
// ---------------------------------------------------------------------------

import type { FieldResponse, FieldResponseMap } from '../types.js';

/**
 * Extract the primary value from a FieldResponse.
 *
 * This converts structured `FieldResponse` objects into simple values
 * suitable for adapters that expect `Record<string, unknown>`.
 *
 * Priority:
 * 1. `answer` — text/longtext fields
 * 2. `selected` — choice fields (radio, check, dropdown, etc.)
 * 3. `multitextAnswers` — multitext fields
 * 4. `signatureData` — signature fields (prefer raw stroke data)
 * 5. `markupData` — diagram fields (prefer raw stroke data)
 *
 * @param response - A single field's response object.
 * @returns The primary value, or undefined if empty.
 */
export function extractResponseValue(
  response: FieldResponse | undefined
): unknown {
  if (!response) return undefined;

  // Text answer takes precedence
  if (response.answer !== undefined) {
    return response.answer;
  }

  // Selection (single or multiple options)
  if (response.selected !== undefined) {
    return response.selected;
  }

  // Multitext answers (Record<optionId, string>)
  if (
    response.multitextAnswers !== undefined &&
    Object.keys(response.multitextAnswers).length > 0
  ) {
    return response.multitextAnswers;
  }

  // Signature: prefer stroke data, fall back to image
  if (response.signatureData !== undefined) {
    return {
      type: 'signature',
      data: response.signatureData,
      image: response.signatureImage,
    };
  }

  // Diagram: prefer stroke data, fall back to image
  if (response.markupData !== undefined) {
    return {
      type: 'diagram',
      data: response.markupData,
      image: response.markupImage,
    };
  }

  return undefined;
}

/**
 * Normalize a FieldResponseMap into a simple `Record<string, unknown>`.
 *
 * Converts structured `FieldResponse` objects into their primary values,
 * stripping metadata like `_ai`. Useful for adapters (FHIR, SurveyJS) that
 * expect flat key-value maps.
 *
 * @param responses - The full response map from the form store.
 * @returns A normalized map of field ID → value.
 *
 * @example
 * ```ts
 * const raw = normalizeResponses(formStore.getState().responses);
 * // { field1: "text answer", field2: { id: "opt1", value: "Yes" }, ... }
 * ```
 */
export function normalizeResponses(
  responses: FieldResponseMap
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [fieldId, response] of Object.entries(responses)) {
    const value = extractResponseValue(response);
    if (value !== undefined) {
      result[fieldId] = value;
    }
  }

  return result;
}
