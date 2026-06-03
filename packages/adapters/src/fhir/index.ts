// ---------------------------------------------------------------------------
// FHIR Adapter - Public API
// ---------------------------------------------------------------------------

// Types
export type {
  // Primitives
  FhirCoding,
  FhirCodeableConcept,
  FhirReference,
  FhirIdentifier,
  FhirPeriod,
  FhirAttachment,
  FhirQuantity,
  FhirExpression,
  FhirExpressionLanguage,
  FhirExtension,
  FhirMeta,
  FhirContactDetail,
  FhirContactPoint,
  FhirUsageContext,
  FhirRange,
  // Questionnaire
  FhirQuestionnaireStatus,
  FhirQuestionnaireItemType,
  FhirEnableWhenOperator,
  FhirEnableBehavior,
  FhirEnableWhen,
  FhirAnswerOption,
  FhirInitialValue,
  FhirQuestionnaireItem,
  FhirQuestionnaire,
  // Response
  FhirResponseStatus,
  FhirResponseAnswer,
  FhirQuestionnaireResponseItem,
  FhirQuestionnaireResponse,
  // Options & Warnings
  FhirImportOptions,
  FhirExportOptions,
  ResponseImportOptions,
  ResponseExportOptions,
  ImportWarning,
  ImportWarningCode,
  ImportWarningSeverity,
  // Metadata
  FhirFieldMeta,
  FhirFormMeta,
} from './types.js';

// Type guards
export { isFhirQuestionnaire, isFhirQuestionnaireResponse } from './utils.js';

// Adapter functions
export {
  importFromFhir,
  exportToFhir,
  importResponseFromFhir,
  exportResponseToFhir,
} from './fhir-adapter.js';

// Utility functions (for advanced users)
export {
  mapFhirTypeToEsheet,
  mapEsheetTypeToFhir,
  convertAnswerOptionToFieldOption,
  convertOptionToFhirAnswerOption,
  mapFhirOperatorToEsheet,
  mapEsheetOperatorToFhir,
  getExtensionValue,
  createItemControlExtension,
  FHIR_EXT,
  ITEM_CONTROL_SYSTEM,
} from './utils.js';
