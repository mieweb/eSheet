// ---------------------------------------------------------------------------
// Validation — validate field responses
// ---------------------------------------------------------------------------

import type {
  FieldResponse,
  FieldResponseMap,
  FieldValidator,
} from '../types.js';
import type { NormalizedDefinition } from '../functions/normalize.js';
import {
  isFieldEffectivelyActive,
  resolveEffect,
  resolveRequiredSeverity,
} from './resolve.js';

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
  /**
   * 'hard' errors block submission.
   * 'soft' errors warn but can be bypassed by the user.
   */
  readonly severity: 'hard' | 'soft';
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
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const fieldId of Object.keys(normalized.byId)) {
    errors.push(
      ...validateField(fieldId, normalized, responses, dangerouslyAllowJS)
    );
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
  responses: FieldResponseMap,
  dangerouslyAllowJS?: boolean
): ValidationError[] {
  const node = normalized.byId[fieldId];
  if (!node) return [];

  const { definition } = node;

  // Non-input field types can't be "answered" — skip.
  if (NON_INPUT_TYPES.has(definition.fieldType)) return [];

  // Hidden or disabled fields, including those inside hidden/disabled sections,
  // shouldn't produce errors.
  if (
    !isFieldEffectivelyActive(
      fieldId,
      normalized,
      responses,
      dangerouslyAllowJS
    )
  )
    return [];

  const errors: ValidationError[] = [];
  const response = responses[fieldId];
  const def = definition as {
    softRequired?: boolean;
    validators?: FieldValidator[];
  };

  // --- Hard / soft required check (rule severity takes precedence over static flag) ---
  if (
    resolveEffect(
      'required',
      definition,
      normalized,
      responses,
      dangerouslyAllowJS
    ) &&
    isResponseEmpty(response)
  ) {
    const severity = resolveRequiredSeverity(definition);
    errors.push({
      fieldId,
      rule: 'required',
      message: 'This field is required',
      severity,
    });
  }

  // --- Soft required check ---
  if (def.softRequired && isResponseEmpty(response)) {
    errors.push({
      fieldId,
      rule: 'softRequired',
      message: 'This field is recommended',
      severity: 'soft',
    });
  }

  // --- Field validators (skip when response is empty) ---
  if (def.validators && !isResponseEmpty(response)) {
    for (const validator of def.validators) {
      const err = runValidator(validator, response, fieldId);
      if (err) errors.push(err);
    }
  }

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
      typeof response.answer === 'string'
        ? response.answer.trim()
        : response.answer;
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

  // fileData — single or multiple file attachments
  if (response.fileData != null) {
    const files = Array.isArray(response.fileData)
      ? response.fileData
      : [response.fileData];
    if (files.length > 0) return false;
  }

  // signatureData
  if (response.signatureData && response.signatureData.trim() !== '')
    return false;

  // markupData
  if (response.markupData && response.markupData.trim() !== '') return false;

  return true;
}

// ---------------------------------------------------------------------------
// Validator runner
// ---------------------------------------------------------------------------

function getRawAnswer(response: FieldResponse | undefined): string {
  if (!response) return '';
  return typeof response.answer === 'string' ? response.answer.trim() : '';
}

/** Parse a date string in MM-DD-YYYY or ISO format. Returns null on failure. */
function parseWcDate(str: string): Date | null {
  const s = str.trim();
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse a datetime string in MM-DD-YYYY HH:mm[:ss] or ISO format. Returns null on failure. */
function parseWcDatetime(str: string): Date | null {
  const s = str.trim();
  const m =
    /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +(m[6] ?? 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Strip time from a Date to midnight for date-only comparisons. */
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse HH:mm into total minutes. Returns null on failure. */
function parseTime(str: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!m) return null;
  return +m[1] * 60 + +m[2];
}

function runValidator(
  validator: FieldValidator,
  response: FieldResponse | undefined,
  fieldId: string
): ValidationError | null {
  const raw = getRawAnswer(response);
  const { type, params = [], message, severity = 'hard' } = validator;

  const fail = (defaultMsg: string): ValidationError => ({
    fieldId,
    rule: type,
    message: message ?? defaultMsg,
    severity,
  });

  switch (type) {
    // ---- Number validators ----
    case 'number': {
      return isNaN(parseFloat(raw)) ? fail('Answer must be a number') : null;
    }
    case 'numberEquals': {
      const n = parseFloat(String(params[0]));
      return parseFloat(raw) === n ? null : fail(`Answer must equal ${n}`);
    }
    case 'numberGreaterThan': {
      const n = parseFloat(String(params[0]));
      return parseFloat(raw) > n
        ? null
        : fail(`Answer must be greater than ${n}`);
    }
    case 'numberLessThan': {
      const n = parseFloat(String(params[0]));
      return parseFloat(raw) < n ? null : fail(`Answer must be less than ${n}`);
    }
    case 'numberBetween': {
      const lo = parseFloat(String(params[0]));
      const hi = parseFloat(String(params[1]));
      const v = parseFloat(raw);
      return v >= lo && v <= hi
        ? null
        : fail(`Answer must be between ${lo} and ${hi}`);
    }
    case 'answerEquals': {
      return raw === String(params[0] ?? '')
        ? null
        : fail(`Answer must equal "${params[0]}"`);
    }

    // ---- Date validators ----
    case 'date': {
      return parseWcDate(raw) ? null : fail('Answer must be a valid date');
    }
    case 'dateEquals': {
      const target = parseWcDate(String(params[0]));
      const value = parseWcDate(raw);
      if (!value || !target) return fail('Answer must be a valid date');
      return dateOnly(value).getTime() === dateOnly(target).getTime()
        ? null
        : fail(`Answer must equal ${params[0]}`);
    }
    case 'dateAfter': {
      const target = parseWcDate(String(params[0]));
      const value = parseWcDate(raw);
      if (!value || !target) return fail('Answer must be a valid date');
      return dateOnly(value) > dateOnly(target)
        ? null
        : fail(`Answer must be after ${params[0]}`);
    }
    case 'dateBefore': {
      const target = parseWcDate(String(params[0]));
      const value = parseWcDate(raw);
      if (!value || !target) return fail('Answer must be a valid date');
      return dateOnly(value) < dateOnly(target)
        ? null
        : fail(`Answer must be before ${params[0]}`);
    }
    case 'dateBetween': {
      const lo = parseWcDate(String(params[0]));
      const hi = parseWcDate(String(params[1]));
      const value = parseWcDate(raw);
      if (!value || !lo || !hi) return fail('Answer must be a valid date');
      const v = dateOnly(value);
      return v >= dateOnly(lo) && v <= dateOnly(hi)
        ? null
        : fail(`Answer must be between ${params[0]} and ${params[1]}`);
    }
    case 'dateAfterToday': {
      const value = parseWcDate(raw);
      if (!value) return fail('Answer must be a valid date');
      return dateOnly(value) > dateOnly(new Date())
        ? null
        : fail("Answer must be after today's date");
    }
    case 'dateBeforeToday': {
      const value = parseWcDate(raw);
      if (!value) return fail('Answer must be a valid date');
      return dateOnly(value) < dateOnly(new Date())
        ? null
        : fail("Answer must be before today's date");
    }
    case 'dateIsToday': {
      const value = parseWcDate(raw);
      if (!value) return fail('Answer must be a valid date');
      return dateOnly(value).getTime() === dateOnly(new Date()).getTime()
        ? null
        : fail("Answer must equal today's date");
    }

    // ---- Datetime validators ----
    case 'datetime': {
      return parseWcDatetime(raw)
        ? null
        : fail('Answer must be a valid datetime');
    }
    case 'datetimeEquals': {
      const target = parseWcDatetime(String(params[0]));
      const value = parseWcDatetime(raw);
      if (!value || !target) return fail('Answer must be a valid datetime');
      return value.getTime() === target.getTime()
        ? null
        : fail(`Answer must equal ${params[0]}`);
    }
    case 'datetimeAfter': {
      const target = parseWcDatetime(String(params[0]));
      const value = parseWcDatetime(raw);
      if (!value || !target) return fail('Answer must be a valid datetime');
      return value > target ? null : fail(`Answer must be after ${params[0]}`);
    }
    case 'datetimeBefore': {
      const target = parseWcDatetime(String(params[0]));
      const value = parseWcDatetime(raw);
      if (!value || !target) return fail('Answer must be a valid datetime');
      return value < target ? null : fail(`Answer must be before ${params[0]}`);
    }
    case 'datetimeBetween': {
      const lo = parseWcDatetime(String(params[0]));
      const hi = parseWcDatetime(String(params[1]));
      const value = parseWcDatetime(raw);
      if (!value || !lo || !hi) return fail('Answer must be a valid datetime');
      return value >= lo && value <= hi
        ? null
        : fail(`Answer must be between ${params[0]} and ${params[1]}`);
    }
    case 'datetimeAfterToday': {
      const value = parseWcDatetime(raw);
      if (!value) return fail('Answer must be a valid datetime');
      return value > dateOnly(new Date())
        ? null
        : fail('Answer must be after today');
    }
    case 'datetimeBeforeToday': {
      const value = parseWcDatetime(raw);
      if (!value) return fail('Answer must be a valid datetime');
      return value < dateOnly(new Date())
        ? null
        : fail('Answer must be before today');
    }
    case 'datetimeIsToday': {
      const value = parseWcDatetime(raw);
      if (!value) return fail('Answer must be a valid datetime');
      return dateOnly(value).getTime() === dateOnly(new Date()).getTime()
        ? null
        : fail('Answer must be today');
    }

    // ---- Time validators (HH:mm) ----
    case 'time': {
      return parseTime(raw) !== null
        ? null
        : fail('Answer must be a valid time (HH:mm)');
    }
    case 'timeEquals': {
      const target = parseTime(String(params[0]));
      const value = parseTime(raw);
      if (value === null || target === null)
        return fail('Answer must be a valid time');
      return value === target ? null : fail(`Answer must equal ${params[0]}`);
    }
    case 'timeAfter': {
      const target = parseTime(String(params[0]));
      const value = parseTime(raw);
      if (value === null || target === null)
        return fail('Answer must be a valid time');
      return value > target ? null : fail(`Answer must be after ${params[0]}`);
    }
    case 'timeBefore': {
      const target = parseTime(String(params[0]));
      const value = parseTime(raw);
      if (value === null || target === null)
        return fail('Answer must be a valid time');
      return value < target ? null : fail(`Answer must be before ${params[0]}`);
    }
    case 'timeBetween': {
      const lo = parseTime(String(params[0]));
      const hi = parseTime(String(params[1]));
      const value = parseTime(raw);
      if (value === null || lo === null || hi === null)
        return fail('Answer must be a valid time');
      return value >= lo && value <= hi
        ? null
        : fail(`Answer must be between ${params[0]} and ${params[1]}`);
    }

    default:
      return null;
  }
}
