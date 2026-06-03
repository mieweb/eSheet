// ---------------------------------------------------------------------------
// FHIR R4 Type Definitions for Questionnaire/QuestionnaireResponse
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Primitive Types
// ---------------------------------------------------------------------------

export interface FhirCoding {
  readonly system?: string;
  readonly version?: string;
  readonly code?: string;
  readonly display?: string;
  readonly userSelected?: boolean;
}

export interface FhirCodeableConcept {
  readonly coding?: readonly FhirCoding[];
  readonly text?: string;
}

export interface FhirReference {
  readonly reference?: string;
  readonly type?: string;
  readonly identifier?: FhirIdentifier;
  readonly display?: string;
}

export interface FhirIdentifier {
  readonly use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  readonly type?: FhirCodeableConcept;
  readonly system?: string;
  readonly value?: string;
  readonly period?: FhirPeriod;
}

export interface FhirPeriod {
  readonly start?: string;
  readonly end?: string;
}

export interface FhirAttachment {
  readonly contentType?: string;
  readonly language?: string;
  readonly data?: string; // Base64
  readonly url?: string;
  readonly size?: number;
  readonly hash?: string;
  readonly title?: string;
  readonly creation?: string;
}

export interface FhirQuantity {
  readonly value?: number;
  readonly comparator?: '<' | '<=' | '>=' | '>';
  readonly unit?: string;
  readonly system?: string;
  readonly code?: string;
}

export type FhirExpressionLanguage =
  | 'text/cql'
  | 'text/fhirpath'
  | 'application/x-fhir-query';

export interface FhirExpression {
  readonly description?: string;
  readonly name?: string;
  readonly language: FhirExpressionLanguage;
  readonly expression?: string;
  readonly reference?: string;
}

export interface FhirExtension {
  readonly url: string;
  readonly valueBoolean?: boolean;
  readonly valueInteger?: number;
  readonly valueDecimal?: number;
  readonly valueString?: string;
  readonly valueUri?: string;
  readonly valueCode?: string;
  readonly valueCoding?: FhirCoding;
  readonly valueCodeableConcept?: FhirCodeableConcept;
  readonly valueExpression?: FhirExpression;
  readonly valueQuantity?: FhirQuantity;
  readonly valueAttachment?: FhirAttachment;
  readonly valueReference?: FhirReference;
  readonly extension?: readonly FhirExtension[]; // Nested extensions
}

export interface FhirMeta {
  readonly versionId?: string;
  readonly lastUpdated?: string;
  readonly source?: string;
  readonly profile?: readonly string[];
  readonly security?: readonly FhirCoding[];
  readonly tag?: readonly FhirCoding[];
}

export interface FhirContactDetail {
  readonly name?: string;
  readonly telecom?: readonly FhirContactPoint[];
}

export interface FhirContactPoint {
  readonly system?:
    | 'phone'
    | 'fax'
    | 'email'
    | 'pager'
    | 'url'
    | 'sms'
    | 'other';
  readonly value?: string;
  readonly use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  readonly rank?: number;
  readonly period?: FhirPeriod;
}

export interface FhirUsageContext {
  readonly code: FhirCoding;
  readonly valueCodeableConcept?: FhirCodeableConcept;
  readonly valueQuantity?: FhirQuantity;
  readonly valueRange?: FhirRange;
  readonly valueReference?: FhirReference;
}

export interface FhirRange {
  readonly low?: FhirQuantity;
  readonly high?: FhirQuantity;
}

// ---------------------------------------------------------------------------
// Questionnaire Types
// ---------------------------------------------------------------------------

export type FhirQuestionnaireStatus =
  | 'draft'
  | 'active'
  | 'retired'
  | 'unknown';

export type FhirQuestionnaireItemType =
  | 'group'
  | 'display'
  | 'boolean'
  | 'decimal'
  | 'integer'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'string'
  | 'text'
  | 'url'
  | 'choice'
  | 'open-choice'
  | 'attachment'
  | 'reference'
  | 'quantity';

export type FhirEnableWhenOperator =
  | 'exists'
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<=';

export type FhirEnableBehavior = 'all' | 'any';

export interface FhirEnableWhen {
  readonly question: string;
  readonly operator: FhirEnableWhenOperator;
  // answer[x] - polymorphic
  readonly answerBoolean?: boolean;
  readonly answerDecimal?: number;
  readonly answerInteger?: number;
  readonly answerDate?: string;
  readonly answerDateTime?: string;
  readonly answerTime?: string;
  readonly answerString?: string;
  readonly answerCoding?: FhirCoding;
  readonly answerQuantity?: FhirQuantity;
  readonly answerReference?: FhirReference;
}

export interface FhirAnswerOption {
  // value[x] - polymorphic
  readonly valueInteger?: number;
  readonly valueDate?: string;
  readonly valueTime?: string;
  readonly valueString?: string;
  readonly valueCoding?: FhirCoding;
  readonly valueReference?: FhirReference;
  readonly initialSelected?: boolean;
  readonly extension?: readonly FhirExtension[];
}

export interface FhirInitialValue {
  // value[x] - polymorphic
  readonly valueBoolean?: boolean;
  readonly valueDecimal?: number;
  readonly valueInteger?: number;
  readonly valueDate?: string;
  readonly valueDateTime?: string;
  readonly valueTime?: string;
  readonly valueString?: string;
  readonly valueUri?: string;
  readonly valueAttachment?: FhirAttachment;
  readonly valueCoding?: FhirCoding;
  readonly valueQuantity?: FhirQuantity;
  readonly valueReference?: FhirReference;
}

export interface FhirQuestionnaireItem {
  readonly linkId: string;
  readonly definition?: string;
  readonly code?: readonly FhirCoding[];
  readonly prefix?: string;
  readonly text?: string;
  readonly type: FhirQuestionnaireItemType;
  readonly enableWhen?: readonly FhirEnableWhen[];
  readonly enableBehavior?: FhirEnableBehavior;
  readonly required?: boolean;
  readonly repeats?: boolean;
  readonly readOnly?: boolean;
  readonly maxLength?: number;
  readonly answerValueSet?: string;
  readonly answerOption?: readonly FhirAnswerOption[];
  readonly initial?: readonly FhirInitialValue[];
  readonly item?: readonly FhirQuestionnaireItem[]; // Nested items (recursive)
  readonly extension?: readonly FhirExtension[];
}

export interface FhirQuestionnaire {
  readonly resourceType: 'Questionnaire';
  readonly id?: string;
  readonly meta?: FhirMeta;
  readonly url?: string;
  readonly identifier?: readonly FhirIdentifier[];
  readonly version?: string;
  readonly name?: string;
  readonly title?: string;
  readonly derivedFrom?: readonly string[];
  readonly status: FhirQuestionnaireStatus;
  readonly experimental?: boolean;
  readonly subjectType?: readonly string[];
  readonly date?: string;
  readonly publisher?: string;
  readonly contact?: readonly FhirContactDetail[];
  readonly description?: string;
  readonly useContext?: readonly FhirUsageContext[];
  readonly jurisdiction?: readonly FhirCodeableConcept[];
  readonly purpose?: string;
  readonly copyright?: string;
  readonly approvalDate?: string;
  readonly lastReviewDate?: string;
  readonly effectivePeriod?: FhirPeriod;
  readonly code?: readonly FhirCoding[];
  readonly item?: readonly FhirQuestionnaireItem[];
  readonly extension?: readonly FhirExtension[];
}

// ---------------------------------------------------------------------------
// QuestionnaireResponse Types
// ---------------------------------------------------------------------------

export type FhirResponseStatus =
  | 'in-progress'
  | 'completed'
  | 'amended'
  | 'entered-in-error'
  | 'stopped';

export interface FhirResponseAnswer {
  // value[x] - polymorphic
  readonly valueBoolean?: boolean;
  readonly valueDecimal?: number;
  readonly valueInteger?: number;
  readonly valueDate?: string;
  readonly valueDateTime?: string;
  readonly valueTime?: string;
  readonly valueString?: string;
  readonly valueUri?: string;
  readonly valueAttachment?: FhirAttachment;
  readonly valueCoding?: FhirCoding;
  readonly valueQuantity?: FhirQuantity;
  readonly valueReference?: FhirReference;
  readonly item?: readonly FhirQuestionnaireResponseItem[]; // Nested items
}

export interface FhirQuestionnaireResponseItem {
  readonly linkId: string;
  readonly definition?: string;
  readonly text?: string;
  readonly answer?: readonly FhirResponseAnswer[];
  readonly item?: readonly FhirQuestionnaireResponseItem[];
}

export interface FhirQuestionnaireResponse {
  readonly resourceType: 'QuestionnaireResponse';
  readonly id?: string;
  readonly meta?: FhirMeta;
  readonly identifier?: FhirIdentifier;
  readonly basedOn?: readonly FhirReference[];
  readonly partOf?: readonly FhirReference[];
  readonly questionnaire: string; // Canonical reference
  readonly status: FhirResponseStatus;
  readonly subject?: FhirReference;
  readonly encounter?: FhirReference;
  readonly authored?: string;
  readonly author?: FhirReference;
  readonly source?: FhirReference;
  readonly item?: readonly FhirQuestionnaireResponseItem[];
  readonly extension?: readonly FhirExtension[];
}

// ---------------------------------------------------------------------------
// Adapter Options & Warnings
// ---------------------------------------------------------------------------

export interface FhirImportOptions {
  /** Override generated form ID. */
  readonly formId?: string;
  /** Keep all extensions in _sourceData (default: true). */
  readonly preserveExtensions?: boolean;
  /** Fail on unsupported features (default: false). */
  readonly strictMode?: boolean;
}

export interface FhirExportOptions {
  /** Override resource ID. */
  readonly resourceId?: string;
  /** Base URL for canonical references. */
  readonly canonicalUrl?: string;
  /** Resource status (default: draft). */
  readonly status?: FhirQuestionnaireStatus;
  /** Publisher name. */
  readonly publisher?: string;
  /** Apply DTR profile constraints. */
  readonly dtrCompliant?: boolean;
}

export interface ResponseImportOptions {
  /** Form schema for type hints. */
  readonly schema?: unknown;
  /** Include display text in output. */
  readonly extractText?: boolean;
}

export interface ResponseExportOptions {
  /** Canonical reference to the questionnaire (required). */
  readonly questionnaireUrl: string;
  /** Patient/subject reference. */
  readonly subject?: FhirReference;
  /** Author reference. */
  readonly author?: FhirReference;
  /** Response status (default: completed). */
  readonly status?: FhirResponseStatus;
  /** Resource ID. */
  readonly resourceId?: string;
}

export type ImportWarningCode =
  | 'UNSUPPORTED_TYPE'
  | 'EXPRESSION_PRESERVED'
  | 'VALUESET_NOT_EXPANDED'
  | 'NESTED_ANSWERS_FLATTENED'
  | 'EXTENSION_PRESERVED'
  | 'REPEAT_NOT_SUPPORTED';

export type ImportWarningSeverity = 'info' | 'warning' | 'error';

export interface ImportWarning {
  readonly path: string; // JSON path (e.g., "item[0].item[2]")
  readonly code: ImportWarningCode;
  readonly message: string;
  /** Severity level. Defaults to 'warning' if omitted. */
  readonly severity?: ImportWarningSeverity;
}

// ---------------------------------------------------------------------------
// Adapter Metadata (stored in _sourceData)
// ---------------------------------------------------------------------------

export interface FhirFieldMeta {
  // Standard FHIR properties not in eSheet schema
  readonly definition?: string;
  readonly code?: readonly FhirCoding[];
  readonly prefix?: string;
  readonly readOnly?: boolean;

  // Extensions preserved verbatim for round-trip
  readonly fhirExtensions?: readonly FhirExtension[];

  // DTR-specific expressions (preserved, not evaluated)
  readonly initialExpression?: FhirExpression;
  readonly calculatedExpression?: FhirExpression;
  readonly enableWhenExpression?: FhirExpression;

  // Validation extensions
  readonly minValue?: number | string;
  readonly maxValue?: number | string;
  readonly minLength?: number;
  readonly regex?: string;

  // Original item type (for ambiguous mappings)
  readonly fhirItemType?: FhirQuestionnaireItemType;

  // Repeats flag for export
  readonly repeats?: boolean;

  // ValueSet URL for client-side resolution
  readonly answerValueSet?: string;
}

export interface FhirFormMeta {
  readonly url?: string;
  readonly version?: string;
  readonly name?: string;
  readonly status?: FhirQuestionnaireStatus;
  readonly publisher?: string;
  readonly date?: string;
  readonly subjectType?: readonly string[];
  readonly derivedFrom?: readonly string[];
  readonly code?: readonly FhirCoding[];
  readonly fhirExtensions?: readonly FhirExtension[];
  readonly _conversionWarnings?: readonly ImportWarning[];
}
