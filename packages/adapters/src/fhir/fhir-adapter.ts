// ---------------------------------------------------------------------------
// FHIR R4 Adapter - Bidirectional conversion
// ---------------------------------------------------------------------------

import type {
  FormDefinition,
  FieldDefinition,
  FieldOption,
  ConditionalRule,
  Condition,
  TextInputType,
  SectionFieldDefinition,
} from '@esheet/core';

import type {
  FhirQuestionnaire,
  FhirQuestionnaireItem,
  FhirQuestionnaireResponse,
  FhirQuestionnaireResponseItem,
  FhirResponseAnswer,
  FhirAnswerOption,
  FhirEnableWhen,
  FhirExtension,
  FhirImportOptions,
  FhirExportOptions,
  ResponseImportOptions,
  ResponseExportOptions,
  ImportWarning,
  FhirFieldMeta,
  FhirFormMeta,
  FhirCoding,
} from './types.js';

import {
  isFhirQuestionnaire,
  isFhirQuestionnaireResponse,
  mapFhirTypeToEsheet,
  mapEsheetTypeToFhir,
  convertAnswerOptionToFieldOption,
  convertOptionToFhirAnswerOption,
  mapFhirOperatorToEsheet,
  mapEsheetOperatorToFhir,
  mapEnableBehaviorToLogic,
  extractEnableWhenAnswer,
  getExtensionValue,
  createItemControlExtension,
  createSignatureRequiredExtension,
  generateUUID,
  FHIR_EXT,
} from './utils.js';

// Re-export type guards
export { isFhirQuestionnaire, isFhirQuestionnaireResponse };

// ---------------------------------------------------------------------------
// Import: FHIR Questionnaire → FormDefinition
// ---------------------------------------------------------------------------

/**
 * Convert a FHIR R4 Questionnaire to an eSheet FormDefinition.
 */
export function importFromFhir(
  questionnaire: FhirQuestionnaire,
  options?: FhirImportOptions
): FormDefinition {
  const warnings: ImportWarning[] = [];
  const formId =
    options?.formId ?? questionnaire.id ?? questionnaire.name ?? generateUUID();

  const form: FormDefinition = {
    id: formId,
    title: questionnaire.title,
    description: questionnaire.description,
    fields: [],
    _sourceData: extractFormMetadata(questionnaire, options),
  };

  if (questionnaire.item) {
    form.fields = questionnaire.item.map((item, index) =>
      convertItemToField(item, `item[${index}]`, warnings, options)
    );
  }

  if (warnings.length > 0) {
    const meta = form._sourceData as FhirFormMeta;
    (meta as { _conversionWarnings: ImportWarning[] })._conversionWarnings =
      warnings;
  }

  return form;
}

function extractFormMetadata(
  q: FhirQuestionnaire,
  options?: FhirImportOptions
): FhirFormMeta {
  const meta: FhirFormMeta = {};
  const preserve = options?.preserveExtensions !== false;

  if (q.url) (meta as { url: string }).url = q.url;
  if (q.version) (meta as { version: string }).version = q.version;
  if (q.name) (meta as { name: string }).name = q.name;
  if (q.status) (meta as { status: string }).status = q.status;
  if (q.publisher) (meta as { publisher: string }).publisher = q.publisher;
  if (q.date) (meta as { date: string }).date = q.date;
  if (q.subjectType)
    (meta as { subjectType: readonly string[] }).subjectType = q.subjectType;
  if (q.derivedFrom)
    (meta as { derivedFrom: readonly string[] }).derivedFrom = q.derivedFrom;
  if (q.code) (meta as { code: readonly FhirCoding[] }).code = q.code;

  if (preserve && q.extension) {
    (meta as { fhirExtensions: readonly FhirExtension[] }).fhirExtensions =
      q.extension;
  }

  return meta;
}

function convertItemToField(
  item: FhirQuestionnaireItem,
  path: string,
  warnings: ImportWarning[],
  options?: FhirImportOptions
): FieldDefinition {
  const typeResult = mapFhirTypeToEsheet(item.type, item);
  const existingIds = new Set<string>();

  // Build base field
  const base = {
    id: item.linkId,
    question: item.text,
    required: item.required,
  };

  // Build _sourceData for round-trip
  const fieldMeta: FhirFieldMeta = buildFieldMeta(item, typeResult, options);
  const hasFieldMeta = Object.keys(fieldMeta).length > 0;

  // Convert enableWhen to rules
  const rules = convertEnableWhenToRules(item.enableWhen, item.enableBehavior);
  const rulesSpread = rules.length > 0 ? { rules } : {};

  // Handle warnings for lossy conversions
  addConversionWarnings(item, path, typeResult, warnings);

  // Build field based on type
  switch (typeResult.fieldType) {
    case 'section':
      return buildSectionField(
        base,
        item,
        path,
        warnings,
        options,
        hasFieldMeta ? fieldMeta : undefined
      );

    case 'radio':
    case 'check':
    case 'dropdown':
    case 'multiselectdropdown':
      return {
        ...base,
        ...(hasFieldMeta ? { _sourceData: fieldMeta } : {}),
        ...rulesSpread,
        fieldType: typeResult.fieldType,
        options: convertAnswerOptions(item.answerOption, existingIds),
      };

    case 'rating':
    case 'slider':
      return {
        ...base,
        ...(hasFieldMeta ? { _sourceData: fieldMeta } : {}),
        ...rulesSpread,
        fieldType: typeResult.fieldType,
        options: convertAnswerOptions(item.answerOption, existingIds),
      };

    case 'text':
    case 'longtext':
      return {
        ...base,
        ...(hasFieldMeta ? { _sourceData: fieldMeta } : {}),
        ...rulesSpread,
        fieldType: typeResult.fieldType,
        ...(typeResult.inputType ? { inputType: typeResult.inputType } : {}),
      };

    case 'display':
      // Display fields have no question — FHIR item.text maps to content (the displayed text)
      return {
        id: base.id,
        ...(hasFieldMeta ? { _sourceData: fieldMeta } : {}),
        ...rulesSpread,
        fieldType: 'display',
        content: item.text,
      };

    case 'boolean':
    case 'signature':
    case 'diagram':
      return {
        ...base,
        ...(hasFieldMeta ? { _sourceData: fieldMeta } : {}),
        ...rulesSpread,
        fieldType: typeResult.fieldType,
      };

    default:
      return {
        ...base,
        ...(hasFieldMeta ? { _sourceData: fieldMeta } : {}),
        ...rulesSpread,
        fieldType: 'text',
      };
  }
}

function buildSectionField(
  base: { id: string; question?: string; required?: boolean },
  item: FhirQuestionnaireItem,
  path: string,
  warnings: ImportWarning[],
  options?: FhirImportOptions,
  fieldMeta?: FhirFieldMeta
): SectionFieldDefinition {
  const nestedFields = item.item
    ? item.item.map((child, i) =>
        convertItemToField(child, `${path}.item[${i}]`, warnings, options)
      )
    : [];

  return {
    ...base,
    ...(fieldMeta ? { _sourceData: fieldMeta } : {}),
    fieldType: 'section',
    title: item.text,
    fields: nestedFields,
  };
}

function buildFieldMeta(
  item: FhirQuestionnaireItem,
  typeResult: {
    fieldType: string;
    inputType?: TextInputType;
    subType?: string;
  },
  options?: FhirImportOptions
): FhirFieldMeta {
  const meta: FhirFieldMeta = {};
  const preserve = options?.preserveExtensions !== false;

  if (item.definition)
    (meta as { definition: string }).definition = item.definition;
  if (item.code) (meta as { code: readonly FhirCoding[] }).code = item.code;
  if (item.prefix) (meta as { prefix: string }).prefix = item.prefix;
  if (item.readOnly) (meta as { readOnly: boolean }).readOnly = item.readOnly;
  if (item.repeats) (meta as { repeats: boolean }).repeats = item.repeats;

  // Store original FHIR type for export
  (meta as { fhirItemType: string }).fhirItemType = item.type;

  // Extract validation extensions
  const minVal = getExtensionValue<number | string>(
    item.extension,
    FHIR_EXT.MIN_VALUE
  );
  const maxVal = getExtensionValue<number | string>(
    item.extension,
    FHIR_EXT.MAX_VALUE
  );
  const minLen = getExtensionValue<number>(item.extension, FHIR_EXT.MIN_LENGTH);
  const regex = getExtensionValue<string>(item.extension, FHIR_EXT.REGEX);

  if (minVal !== undefined)
    (meta as { minValue: number | string }).minValue = minVal;
  if (maxVal !== undefined)
    (meta as { maxValue: number | string }).maxValue = maxVal;
  if (minLen !== undefined) (meta as { minLength: number }).minLength = minLen;
  if (regex !== undefined) (meta as { regex: string }).regex = regex;

  // Preserve unknown extensions
  if (preserve && item.extension) {
    (meta as { fhirExtensions: readonly FhirExtension[] }).fhirExtensions =
      item.extension;
  }

  // Preserve answerValueSet URL for client-side resolution
  if (item.answerValueSet) {
    (meta as { answerValueSet: string }).answerValueSet = item.answerValueSet;
  }

  return meta;
}

function convertAnswerOptions(
  answerOptions: readonly FhirAnswerOption[] | undefined,
  existingIds: Set<string>
): FieldOption[] {
  if (!answerOptions) return [];

  return answerOptions.map((opt, index) =>
    convertAnswerOptionToFieldOption(opt, existingIds, index)
  );
}

function convertEnableWhenToRules(
  enableWhen: readonly FhirEnableWhen[] | undefined,
  enableBehavior: 'all' | 'any' | undefined
): ConditionalRule[] {
  if (!enableWhen || enableWhen.length === 0) return [];

  const conditions: Condition[] = [];

  for (const ew of enableWhen) {
    const operator = mapFhirOperatorToEsheet(ew.operator, ew.answerBoolean);
    if (!operator) continue;

    conditions.push({
      conditionType: 'field',
      targetId: ew.question,
      operator,
      expected: extractEnableWhenAnswer(ew),
    });
  }

  if (conditions.length === 0) return [];

  return [
    {
      effect: 'visible',
      logic: mapEnableBehaviorToLogic(enableBehavior),
      conditions,
    },
  ];
}

function addConversionWarnings(
  item: FhirQuestionnaireItem,
  path: string,
  typeResult: { fieldType: string; subType?: string },
  warnings: ImportWarning[]
): void {
  // Reference type warning
  if (typeResult.subType === 'reference') {
    warnings.push({
      path,
      code: 'UNSUPPORTED_TYPE',
      message: `FHIR reference type converted to text field. Type safety lost.`,
    });
  }

  // Quantity type warning
  if (typeResult.subType === 'quantity') {
    warnings.push({
      path,
      code: 'UNSUPPORTED_TYPE',
      message: `FHIR quantity type converted to number field. Unit choices lost.`,
    });
  }

  // ValueSet reference (informational)
  if (item.answerValueSet) {
    warnings.push({
      path,
      code: 'VALUESET_NOT_EXPANDED',
      severity: 'info',
      message: `ValueSet "${item.answerValueSet}" requires expansion. URL preserved in _sourceData.answerValueSet for client-side $expand.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Export: FormDefinition → FHIR Questionnaire
// ---------------------------------------------------------------------------

/**
 * Convert an eSheet FormDefinition to a FHIR R4 Questionnaire.
 */
export function exportToFhir(
  form: FormDefinition,
  options?: FhirExportOptions
): FhirQuestionnaire {
  const sourceMeta = form._sourceData as FhirFormMeta | undefined;

  const questionnaire: FhirQuestionnaire = {
    resourceType: 'Questionnaire',
    id: options?.resourceId ?? form.id,
    url: options?.canonicalUrl
      ? `${options.canonicalUrl}/Questionnaire/${form.id}`
      : sourceMeta?.url ?? `urn:uuid:${generateUUID()}`,
    status: options?.status ?? sourceMeta?.status ?? 'draft',
    title: form.title,
    description: form.description,
    ...(sourceMeta?.version ? { version: sourceMeta.version } : {}),
    ...(options?.publisher ?? sourceMeta?.publisher
      ? { publisher: options?.publisher ?? sourceMeta?.publisher }
      : {}),
    ...(sourceMeta?.date ? { date: sourceMeta.date } : {}),
    item: form.fields.map(convertFieldToItem),
  };

  // DTR compliance
  if (options?.dtrCompliant) {
    (questionnaire as unknown as { subjectType: string[] }).subjectType = [
      'Patient',
    ];
  }

  // Restore preserved extensions
  if (sourceMeta?.fhirExtensions) {
    (
      questionnaire as unknown as { extension: readonly FhirExtension[] }
    ).extension = sourceMeta.fhirExtensions;
  }

  return questionnaire;
}

function convertFieldToItem(field: FieldDefinition): FhirQuestionnaireItem {
  const fieldMeta = field._sourceData as FhirFieldMeta | undefined;
  const inputType =
    'inputType' in field ? (field.inputType as TextInputType) : undefined;
  const typeResult = mapEsheetTypeToFhir(field.fieldType, inputType);

  // For sections, use title if question is not set
  const text =
    (field as { question?: string }).question ??
    (field.fieldType === 'section' && 'title' in field
      ? field.title
      : undefined);

  const item: FhirQuestionnaireItem = {
    linkId: field.id,
    text,
    type: typeResult.type,
    ...(field.required ? { required: true } : {}),
    ...(typeResult.repeats ? { repeats: true } : {}),
    ...(fieldMeta?.readOnly ? { readOnly: true } : {}),
  };

  // Build extensions array
  const extensions: FhirExtension[] = [];

  // Add itemControl extension
  if (typeResult.itemControl) {
    extensions.push(createItemControlExtension(typeResult.itemControl));
  }

  // Add signature extension for signature fields
  if (field.fieldType === 'signature') {
    extensions.push(createSignatureRequiredExtension());
  }

  // Add preserved extensions
  if (fieldMeta?.fhirExtensions) {
    // Filter out extensions we're generating ourselves
    const preserved = fieldMeta.fhirExtensions.filter(
      (e) =>
        e.url !== FHIR_EXT.ITEM_CONTROL && e.url !== FHIR_EXT.SIGNATURE_REQUIRED
    );
    extensions.push(...preserved);
  }

  if (extensions.length > 0) {
    (item as unknown as { extension: FhirExtension[] }).extension = extensions;
  }

  // Add answer options
  if ('options' in field && field.options && field.options.length > 0) {
    (item as unknown as { answerOption: FhirAnswerOption[] }).answerOption =
      field.options.map(convertOptionToFhirAnswerOption);
  }

  // Add enableWhen for visibility rules
  const enableWhen = convertRulesToEnableWhen(field.rules);
  if (enableWhen.length > 0) {
    (item as unknown as { enableWhen: FhirEnableWhen[] }).enableWhen =
      enableWhen;
    if (enableWhen.length > 1) {
      // Check original logic mode
      const visibleRule = field.rules?.find((r) => r.effect === 'visible');
      (item as unknown as { enableBehavior: 'all' | 'any' }).enableBehavior =
        visibleRule?.logic === 'OR' ? 'any' : 'all';
    }
  }

  // Handle nested fields for sections
  if (field.fieldType === 'section' && 'fields' in field && field.fields) {
    (item as unknown as { item: FhirQuestionnaireItem[] }).item =
      field.fields.map(convertFieldToItem);
  }

  // Restore definition, code, prefix from metadata
  if (fieldMeta?.definition)
    (item as { definition: string }).definition = fieldMeta.definition;
  if (fieldMeta?.code)
    (item as { code: readonly FhirCoding[] }).code = fieldMeta.code;
  if (fieldMeta?.prefix) (item as { prefix: string }).prefix = fieldMeta.prefix;

  return item;
}

function convertRulesToEnableWhen(
  rules: ConditionalRule[] | undefined
): FhirEnableWhen[] {
  if (!rules) return [];

  // Only convert 'visible' rules to enableWhen
  const visibleRule = rules.find((r) => r.effect === 'visible');
  if (!visibleRule) return [];

  return visibleRule.conditions
    .map((cond) => {
      if (cond.conditionType === 'expression') return null;
      if (!cond.targetId || !cond.operator) return null;

      const fhirOp = mapEsheetOperatorToFhir(cond.operator);
      if (!fhirOp) return null;

      const ew: FhirEnableWhen = {
        question: cond.targetId,
        operator: fhirOp.operator,
      };

      // Set the answer value
      if (fhirOp.answerBoolean !== undefined) {
        (ew as { answerBoolean: boolean }).answerBoolean = fhirOp.answerBoolean;
      } else if (cond.expected !== undefined) {
        // Determine answer type based on expected value
        if (cond.expected === 'true' || cond.expected === 'false') {
          (ew as { answerBoolean: boolean }).answerBoolean =
            cond.expected === 'true';
        } else if (!isNaN(Number(cond.expected))) {
          (ew as { answerDecimal: number }).answerDecimal = Number(
            cond.expected
          );
        } else {
          (ew as { answerString: string }).answerString = cond.expected;
        }
      }

      return ew;
    })
    .filter((ew): ew is FhirEnableWhen => ew !== null);
}

// ---------------------------------------------------------------------------
// Import: FHIR QuestionnaireResponse → Answers
// ---------------------------------------------------------------------------

/**
 * Convert a FHIR QuestionnaireResponse to an eSheet answer map.
 */
export function importResponseFromFhir(
  response: FhirQuestionnaireResponse,
  options?: ResponseImportOptions
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  if (response.item) {
    collectResponseAnswers(response.item, answers);
  }

  return answers;
}

function collectResponseAnswers(
  items: readonly FhirQuestionnaireResponseItem[],
  answers: Record<string, unknown>
): void {
  for (const item of items) {
    if (item.answer && item.answer.length > 0) {
      answers[item.linkId] = extractAnswerValue(item.answer);
    }

    // Recurse into nested items
    if (item.item) {
      collectResponseAnswers(item.item, answers);
    }

    // Also recurse into answer-nested items
    for (const ans of item.answer ?? []) {
      if (ans.item) {
        collectResponseAnswers(ans.item, answers);
      }
    }
  }
}

function extractAnswerValue(answers: readonly FhirResponseAnswer[]): unknown {
  // Multiple answers → array (for repeating items)
  if (answers.length > 1) {
    return answers.map(extractSingleAnswerValue);
  }

  return extractSingleAnswerValue(answers[0]);
}

function extractSingleAnswerValue(answer: FhirResponseAnswer): unknown {
  if (answer.valueBoolean !== undefined) return answer.valueBoolean;
  if (answer.valueDecimal !== undefined) return answer.valueDecimal;
  if (answer.valueInteger !== undefined) return answer.valueInteger;
  if (answer.valueDate !== undefined) return answer.valueDate;
  if (answer.valueDateTime !== undefined) return answer.valueDateTime;
  if (answer.valueTime !== undefined) return answer.valueTime;
  if (answer.valueString !== undefined) return answer.valueString;
  if (answer.valueUri !== undefined) return answer.valueUri;
  if (answer.valueCoding) return answer.valueCoding.code;
  if (answer.valueQuantity) return answer.valueQuantity.value;
  if (answer.valueAttachment) return answer.valueAttachment.data;
  if (answer.valueReference) return answer.valueReference.reference;

  return undefined;
}

// ---------------------------------------------------------------------------
// Export: Answers → FHIR QuestionnaireResponse
// ---------------------------------------------------------------------------

/**
 * Convert eSheet answers to a FHIR QuestionnaireResponse.
 */
export function exportResponseToFhir(
  form: FormDefinition,
  answers: Record<string, unknown>,
  options: ResponseExportOptions
): FhirQuestionnaireResponse {
  const response: FhirQuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    ...(options.resourceId ? { id: options.resourceId } : {}),
    questionnaire: options.questionnaireUrl,
    status: options.status ?? 'completed',
    ...(options.subject ? { subject: options.subject } : {}),
    ...(options.author ? { author: options.author } : {}),
    authored: new Date().toISOString(),
    item: convertFieldsToResponseItems(form.fields, answers),
  };

  return response;
}

function convertFieldsToResponseItems(
  fields: readonly FieldDefinition[],
  answers: Record<string, unknown>
): FhirQuestionnaireResponseItem[] {
  const items: FhirQuestionnaireResponseItem[] = [];

  for (const field of fields) {
    const item = convertFieldToResponseItem(field, answers);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

function convertFieldToResponseItem(
  field: FieldDefinition,
  answers: Record<string, unknown>
): FhirQuestionnaireResponseItem | null {
  const value = answers[field.id];

  // Handle sections recursively
  if (field.fieldType === 'section' && 'fields' in field && field.fields) {
    const nestedItems = convertFieldsToResponseItems(field.fields, answers);
    if (nestedItems.length === 0) return null;

    return {
      linkId: field.id,
      text: (field as { question?: string }).question,
      item: nestedItems,
    };
  }

  // Skip fields with no answer
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const item: FhirQuestionnaireResponseItem = {
    linkId: field.id,
    text: (field as { question?: string }).question,
    answer: convertValueToAnswers(field, value),
  };

  return item;
}

function convertValueToAnswers(
  field: FieldDefinition,
  value: unknown
): FhirResponseAnswer[] {
  const inputType =
    'inputType' in field ? (field.inputType as TextInputType) : undefined;

  switch (field.fieldType) {
    case 'text':
    case 'longtext':
      return [convertTextAnswer(value, inputType)];

    case 'boolean':
      return [{ valueBoolean: Boolean(value) }];

    case 'radio':
    case 'dropdown':
      return [createCodingAnswer(field, value as string)];

    case 'check':
    case 'multiselectdropdown': {
      const selected = Array.isArray(value) ? value : [value];
      return selected.map((v) => createCodingAnswer(field, v as string));
    }

    case 'rating':
    case 'slider':
      return [{ valueInteger: Number(value) }];

    case 'signature':
    case 'diagram':
      return [
        {
          valueAttachment: {
            contentType: 'image/png',
            data: value as string,
          },
        },
      ];

    default:
      return [{ valueString: String(value) }];
  }
}

function convertTextAnswer(
  value: unknown,
  inputType?: TextInputType
): FhirResponseAnswer {
  switch (inputType) {
    case 'number':
      return { valueDecimal: Number(value) };
    case 'date':
      return { valueDate: value as string };
    case 'datetime-local':
      return { valueDateTime: value as string };
    case 'time':
      return { valueTime: value as string };
    case 'url':
      return { valueUri: value as string };
    default:
      return { valueString: String(value) };
  }
}

function createCodingAnswer(
  field: FieldDefinition,
  selectedId: string
): FhirResponseAnswer {
  const options = 'options' in field ? field.options : undefined;
  const option = options?.find((o: FieldOption) => o.id === selectedId);

  return {
    valueCoding: {
      code: option?.value ?? selectedId,
      display: option?.text,
    },
  };
}
