// ---------------------------------------------------------------------------
// FHIR Adapter Utilities
// ---------------------------------------------------------------------------

import type {
  FieldOption,
  ConditionOperator,
  TextInputType,
} from '@esheet/core';
import { generateOptionId } from '@esheet/core';

import type {
  FhirQuestionnaire,
  FhirQuestionnaireResponse,
  FhirQuestionnaireItemType,
  FhirQuestionnaireItem,
  FhirCoding,
  FhirAnswerOption,
  FhirEnableWhen,
  FhirEnableBehavior,
  FhirEnableWhenOperator,
  FhirExtension,
  FhirCodeableConcept,
} from './types.js';

// ---------------------------------------------------------------------------
// Extension URLs (Constants)
// ---------------------------------------------------------------------------

export const FHIR_EXT = {
  // Questionnaire item control
  ITEM_CONTROL:
    'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',

  // Validation
  MIN_VALUE: 'http://hl7.org/fhir/StructureDefinition/minValue',
  MAX_VALUE: 'http://hl7.org/fhir/StructureDefinition/maxValue',
  MIN_LENGTH: 'http://hl7.org/fhir/StructureDefinition/minLength',
  REGEX: 'http://hl7.org/fhir/StructureDefinition/regex',

  // Option scoring
  ORDINAL_VALUE: 'http://hl7.org/fhir/StructureDefinition/ordinalValue',

  // Display
  HIDDEN: 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden',
  ITEM_MEDIA: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemMedia',

  // Slider
  SLIDER_STEP:
    'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue',

  // Signature
  SIGNATURE_REQUIRED:
    'http://hl7.org/fhir/StructureDefinition/questionnaire-signatureRequired',

  // SDC / DTR
  INITIAL_EXPRESSION:
    'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
  CALCULATED_EXPRESSION:
    'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression',
  ENABLE_WHEN_EXPRESSION:
    'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression',
  VARIABLE: 'http://hl7.org/fhir/StructureDefinition/variable',
} as const;

export const ITEM_CONTROL_SYSTEM =
  'http://hl7.org/fhir/questionnaire-item-control';

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Type guard to check if a value is a FHIR Questionnaire resource.
 */
export function isFhirQuestionnaire(
  value: unknown
): value is FhirQuestionnaire {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['resourceType'] === 'Questionnaire';
}

/**
 * Type guard to check if a value is a FHIR QuestionnaireResponse resource.
 */
export function isFhirQuestionnaireResponse(
  value: unknown
): value is FhirQuestionnaireResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['resourceType'] === 'QuestionnaireResponse';
}

// ---------------------------------------------------------------------------
// Type Mapping: FHIR → eSheet
// ---------------------------------------------------------------------------

export interface EsheetFieldTypeResult {
  readonly fieldType: string;
  readonly inputType?: TextInputType;
  readonly subType?: string;
}

/**
 * Map a FHIR item type to eSheet field type.
 */
export function mapFhirTypeToEsheet(
  fhirType: FhirQuestionnaireItemType,
  item: FhirQuestionnaireItem
): EsheetFieldTypeResult {
  const itemControl = getItemControlCode(item.extension);

  switch (fhirType) {
    case 'string':
      return { fieldType: 'text', inputType: 'string' };

    case 'text':
      return { fieldType: 'longtext' };

    case 'boolean':
      return { fieldType: 'boolean' };

    case 'decimal':
      return { fieldType: 'text', inputType: 'number' };

    case 'integer':
      if (itemControl === 'slider') {
        return { fieldType: 'slider' };
      }
      return { fieldType: 'text', inputType: 'number' };

    case 'date':
      return { fieldType: 'text', inputType: 'date' };

    case 'dateTime':
      return { fieldType: 'text', inputType: 'datetime-local' };

    case 'time':
      return { fieldType: 'text', inputType: 'time' };

    case 'url':
      return { fieldType: 'text', inputType: 'url' };

    case 'choice':
    case 'open-choice':
      return mapChoiceType(item, itemControl);

    case 'group':
      return { fieldType: 'section' };

    case 'display':
      return { fieldType: 'display' };

    case 'attachment':
      if (hasSignatureRequired(item.extension)) {
        return { fieldType: 'signature' };
      }
      return { fieldType: 'file' };

    case 'reference':
      return { fieldType: 'text', subType: 'reference' };

    case 'quantity':
      return { fieldType: 'text', inputType: 'number', subType: 'quantity' };

    default:
      return { fieldType: 'text' };
  }
}

function mapChoiceType(
  item: FhirQuestionnaireItem,
  itemControl: string | undefined
): EsheetFieldTypeResult {
  const repeats = item.repeats ?? false;

  if (itemControl === 'drop-down' || itemControl === 'autocomplete') {
    return repeats
      ? { fieldType: 'multiselectdropdown' }
      : { fieldType: 'dropdown' };
  }

  if (itemControl === 'open-choice') {
    return { fieldType: 'openchoice' };
  }

  if (itemControl === 'check-box') {
    return { fieldType: 'check' };
  }

  if (itemControl === 'radio-button') {
    return { fieldType: 'radio' };
  }

  // Default based on repeats
  return repeats ? { fieldType: 'check' } : { fieldType: 'radio' };
}

// ---------------------------------------------------------------------------
// Type Mapping: eSheet → FHIR
// ---------------------------------------------------------------------------

export interface FhirFieldTypeResult {
  readonly type: FhirQuestionnaireItemType;
  readonly itemControl?: string;
  readonly repeats?: boolean;
}

/**
 * Map an eSheet field type to FHIR item type.
 */
export function mapEsheetTypeToFhir(
  esheetType: string,
  inputType?: TextInputType,
  subType?: string
): FhirFieldTypeResult {
  switch (esheetType) {
    case 'text':
      return mapTextTypeToFhir(inputType);

    case 'longtext':
      return { type: 'text' };

    case 'boolean':
      return { type: 'boolean' };

    case 'radio':
      return { type: 'choice', itemControl: 'radio-button' };

    case 'check':
      return { type: 'choice', itemControl: 'check-box', repeats: true };

    case 'dropdown':
      return { type: 'choice', itemControl: 'drop-down' };

    case 'multiselectdropdown':
      return { type: 'choice', itemControl: 'drop-down', repeats: true };

    case 'rating':
      return { type: 'integer', itemControl: 'slider' };

    case 'slider':
      return { type: 'decimal', itemControl: 'slider' };

    case 'section':
      return { type: 'group' };

    case 'display':
      return { type: 'display' };

    case 'signature':
      return { type: 'attachment' };

    case 'diagram':
      return { type: 'attachment' };

    case 'file':
      return { type: 'attachment' };

    case 'openchoice':
      return { type: 'choice', itemControl: 'open-choice' };

    case 'singlematrix':
    case 'multimatrix':
      return { type: 'group' };

    case 'image':
    case 'html':
      return { type: 'display' };

    default:
      return { type: 'string' };
  }
}

function mapTextTypeToFhir(inputType?: TextInputType): FhirFieldTypeResult {
  switch (inputType) {
    case 'number':
      return { type: 'decimal' };
    case 'date':
      return { type: 'date' };
    case 'datetime-local':
      return { type: 'dateTime' };
    case 'time':
      return { type: 'time' };
    case 'url':
      return { type: 'url' };
    default:
      return { type: 'string' };
  }
}

// ---------------------------------------------------------------------------
// Options Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a FHIR Coding to an eSheet FieldOption.
 */
export function convertFhirCodingToOption(
  coding: FhirCoding,
  existingIds: Set<string>,
  fallbackIndex: number
): FieldOption {
  const id =
    coding.code ?? generateOptionId(existingIds, `opt-${fallbackIndex}`);
  existingIds.add(id);

  return {
    id,
    value: coding.code ?? '',
    ...(coding.display ? { text: coding.display } : {}),
  };
}

/**
 * Convert a FHIR answerOption to an eSheet FieldOption.
 */
export function convertAnswerOptionToFieldOption(
  option: FhirAnswerOption,
  existingIds: Set<string>,
  index: number
): FieldOption {
  const opt: FieldOption = {
    id: '',
    value: '',
  };

  if (option.valueCoding) {
    opt.id =
      option.valueCoding.code ?? generateOptionId(existingIds, `opt-${index}`);
    opt.value = option.valueCoding.code ?? '';
    if (option.valueCoding.display) {
      opt.text = option.valueCoding.display;
    }
  } else if (option.valueString !== undefined) {
    opt.id = toKebabCase(option.valueString) || `opt-${index}`;
    opt.value = option.valueString;
  } else if (option.valueInteger !== undefined) {
    opt.id = String(option.valueInteger);
    opt.value = String(option.valueInteger);
  } else if (option.valueDate !== undefined) {
    opt.id = `date-${index}`;
    opt.value = option.valueDate;
  } else if (option.valueTime !== undefined) {
    opt.id = `time-${index}`;
    opt.value = option.valueTime;
  } else {
    opt.id = generateOptionId(existingIds, `opt-${index}`);
  }

  existingIds.add(opt.id);

  // Extract ordinalValue score from extension
  const ordinalExt = option.extension?.find(
    (e) => e.url === FHIR_EXT.ORDINAL_VALUE
  );
  if (ordinalExt?.valueDecimal !== undefined) {
    opt.score = ordinalExt.valueDecimal;
  } else if (ordinalExt?.valueInteger !== undefined) {
    opt.score = ordinalExt.valueInteger;
  }

  return opt;
}

/**
 * Convert an eSheet FieldOption to a FHIR answerOption.
 */
export function convertOptionToFhirAnswerOption(
  option: FieldOption
): FhirAnswerOption {
  const result: FhirAnswerOption = {};

  // Prefer valueCoding for rich options (with display text or score)
  if (option.text || option.score !== undefined) {
    (result as { valueCoding: FhirCoding }).valueCoding = {
      code: option.value,
      display: option.text ?? option.value,
      system: 'urn:esheet:options',
    };

    if (option.score !== undefined) {
      (result as { extension: FhirExtension[] }).extension = [
        {
          url: FHIR_EXT.ORDINAL_VALUE,
          valueDecimal: option.score,
        },
      ];
    }
  } else {
    (result as { valueString: string }).valueString = option.value;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Condition/EnableWhen Conversion
// ---------------------------------------------------------------------------

/**
 * Map a FHIR enableWhen operator to an eSheet condition operator.
 */
export function mapFhirOperatorToEsheet(
  operator: FhirEnableWhenOperator,
  answerBoolean?: boolean
): ConditionOperator | null {
  switch (operator) {
    case '=':
      return 'equals';
    case '!=':
      return 'notEquals';
    case '>':
      return 'greaterThan';
    case '>=':
      return 'greaterThanOrEqual';
    case '<':
      return 'lessThan';
    case '<=':
      return 'lessThanOrEqual';
    case 'exists':
      return answerBoolean === true ? 'notEmpty' : 'empty';
    default:
      return null;
  }
}

/**
 * Map an eSheet condition operator to a FHIR enableWhen operator.
 */
export function mapEsheetOperatorToFhir(
  operator: ConditionOperator
): { operator: FhirEnableWhenOperator; answerBoolean?: boolean } | null {
  switch (operator) {
    case 'equals':
      return { operator: '=' };
    case 'notEquals':
      return { operator: '!=' };
    case 'greaterThan':
      return { operator: '>' };
    case 'greaterThanOrEqual':
      return { operator: '>=' };
    case 'lessThan':
      return { operator: '<' };
    case 'lessThanOrEqual':
      return { operator: '<=' };
    case 'empty':
      return { operator: 'exists', answerBoolean: false };
    case 'notEmpty':
      return { operator: 'exists', answerBoolean: true };
    case 'contains':
    case 'includes':
      // These require FHIRPath expressions, not supported in basic enableWhen
      return null;
    default:
      return null;
  }
}

/**
 * Map FHIR enableBehavior to eSheet logic mode.
 */
export function mapEnableBehaviorToLogic(
  behavior: FhirEnableBehavior | undefined
): 'AND' | 'OR' {
  return behavior === 'any' ? 'OR' : 'AND';
}

/**
 * Extract the answer value from a FHIR enableWhen condition.
 */
export function extractEnableWhenAnswer(
  enableWhen: FhirEnableWhen
): string | undefined {
  if (enableWhen.answerBoolean !== undefined) {
    return String(enableWhen.answerBoolean);
  }
  if (enableWhen.answerDecimal !== undefined) {
    return String(enableWhen.answerDecimal);
  }
  if (enableWhen.answerInteger !== undefined) {
    return String(enableWhen.answerInteger);
  }
  if (enableWhen.answerDate !== undefined) {
    return enableWhen.answerDate;
  }
  if (enableWhen.answerDateTime !== undefined) {
    return enableWhen.answerDateTime;
  }
  if (enableWhen.answerTime !== undefined) {
    return enableWhen.answerTime;
  }
  if (enableWhen.answerString !== undefined) {
    return enableWhen.answerString;
  }
  if (enableWhen.answerCoding?.code !== undefined) {
    return enableWhen.answerCoding.code;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Extension Helpers
// ---------------------------------------------------------------------------

/**
 * Get the value of an extension by URL.
 */
export function getExtensionValue<T = unknown>(
  extensions: readonly FhirExtension[] | undefined,
  url: string
): T | undefined {
  if (!extensions) return undefined;

  const ext = extensions.find((e) => e.url === url);
  if (!ext) return undefined;

  // Return the first non-url value property
  for (const key of Object.keys(ext)) {
    if (key.startsWith('value')) {
      return ext[key as keyof FhirExtension] as T;
    }
  }
  return undefined;
}

/**
 * Get the itemControl code from extensions.
 */
export function getItemControlCode(
  extensions: readonly FhirExtension[] | undefined
): string | undefined {
  if (!extensions) return undefined;

  const ext = extensions.find((e) => e.url === FHIR_EXT.ITEM_CONTROL);
  if (!ext) return undefined;

  // itemControl uses valueCodeableConcept
  const coding = ext.valueCodeableConcept?.coding?.[0];
  return coding?.code;
}

/**
 * Check if the signatureRequired extension is present and true.
 */
export function hasSignatureRequired(
  extensions: readonly FhirExtension[] | undefined
): boolean {
  if (!extensions) return false;

  const ext = extensions.find((e) => e.url === FHIR_EXT.SIGNATURE_REQUIRED);
  return ext?.valueBoolean === true;
}

/**
 * Create an itemControl extension.
 */
export function createItemControlExtension(controlType: string): FhirExtension {
  return {
    url: FHIR_EXT.ITEM_CONTROL,
    valueCodeableConcept: {
      coding: [
        {
          system: ITEM_CONTROL_SYSTEM,
          code: controlType,
        },
      ],
    } as FhirCodeableConcept,
  };
}

/**
 * Create a signatureRequired extension.
 */
export function createSignatureRequiredExtension(): FhirExtension {
  return {
    url: FHIR_EXT.SIGNATURE_REQUIRED,
    valueBoolean: true,
  };
}

// ---------------------------------------------------------------------------
// String Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a string to kebab-case for use as an ID.
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a simple UUID v4.
 */
export function generateUUID(): string {
  // Simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
