// ---------------------------------------------------------------------------
// Validation — validate field responses
// ---------------------------------------------------------------------------

import type { FieldResponse, FormResponse } from '../types.js';
import type { NormalizedDefinition } from '../functions/normalize.js';
import { resolveEffect } from './resolve.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single validation error for a field. */
export interface ValidationError {
  /** The field that failed validation. */
  readonly fieldId: string;
  /** Which validation rule failed (e.g. `'required'`). */
  readonly rule: string;
  /** Human-readable error message. */
  readonly message: string;
}

// ---------------------------------------------------------------------------
// validateForm()
// ---------------------------------------------------------------------------

/**
 * Validate all fields in the form and collect errors.
 *
 * Iterates every field in the normalized definition, runs all validation
 * checks, and returns a flat array of errors. An empty array means the
 * form is valid.
 *
 * @param normalized - The normalized form definition (flat `byId` map).
 * @param responses  - The current form responses.
 */
export function validateForm(
  normalized: NormalizedDefinition,
  responses: FormResponse,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const fieldId of Object.keys(normalized.byId)) {
    errors.push(...validateField(fieldId, normalized, responses));
  }
  return errors;
}

// ---------------------------------------------------------------------------
// validateField()
// ---------------------------------------------------------------------------

/**
 * Validate a single field's response and return any errors.
 *
 * Currently checks:
 * - **required** — field is required but response is empty.
 *
 * Skips validation for:
 * - Unknown field IDs.
 * - Non-visible fields (hidden by conditional rules).
 * - Non-input field types (section, expression, html, image).
 *
 * @param fieldId    - The field ID to validate.
 * @param normalized - The normalized form definition (flat `byId` map).
 * @param responses  - The current form responses.
 */
export function validateField(
  fieldId: string,
  normalized: NormalizedDefinition,
  responses: FormResponse,
): ValidationError[] {
  const node = normalized.byId[fieldId];
  if (!node) return [];

  const { definition } = node;

  // Non-input field types can't be "answered" — skip.
  if (NON_INPUT_TYPES.has(definition.fieldType)) return [];

  // Hidden fields shouldn't produce errors.
  if (!resolveEffect('visible', definition, normalized, responses)) return [];

  const errors: ValidationError[] = [];
  const response = responses[fieldId];

  // --- Required check ---
  if (
    resolveEffect('required', definition, normalized, responses) &&
    isResponseEmpty(response)
  ) {
    errors.push({
      fieldId,
      rule: 'required',
      message: 'This field is required',
    });
  }

  // Future checks (format, min/max, pattern, etc.) go here.

  return errors;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Field types that don't accept user input — skip validation. */
const NON_INPUT_TYPES = new Set(['section', 'expression', 'html', 'image']);

/**
 * Check whether a field response is effectively empty.
 *
 * Inspects all response properties — if none contain meaningful data,
 * the response is empty. Handles edge cases:
 * - `false` and `0` are valid answers (not empty).
 * - Whitespace-only strings are treated as empty.
 * - Empty arrays/objects count as empty.
 */
function isResponseEmpty(response: FieldResponse | undefined): boolean {
  if (!response) return true;

  // answer — text, number, boolean
  if (response.answer !== undefined && response.answer !== null) {
    const a =
      typeof response.answer === 'string' ? response.answer.trim() : response.answer;
    if (a !== '') return false;
  }

  // selected — single or multi-select, or matrix record
  if (response.selected !== undefined && response.selected !== null) {
    if (Array.isArray(response.selected)) {
      if (response.selected.length > 0) return false;
    } else if (typeof response.selected === 'object') {
      // SelectedOption (has id) or Record<string, ...> (matrix)
      if ('id' in response.selected) return false; // single selection
      if (Object.keys(response.selected).length > 0) return false; // matrix
    }
  }

  // multitextAnswers — Record<string, string>
  if (response.multitextAnswers) {
    const values = Object.values(response.multitextAnswers);
    if (values.some((v) => v.trim() !== '')) return false;
  }

  // signatureData
  if (response.signatureData && response.signatureData.trim() !== '') return false;

  // markupData
  if (response.markupData && response.markupData.trim() !== '') return false;

  return true;
}
