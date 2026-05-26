// =============================================================================
// @esheet/adapters - Convert external form schemas to eSheet FormDefinition
// =============================================================================

export {
  convertSurveyJS,
  convertSurveyJSToESheet,
  importFromSurveyJS,
  exportToSurveyJS,
  isSurveyJSSchema,
  SURVEYJS_SYSTEM_PROMPT,
  type SurveyJSDetectionSchema,
} from './lib/surveyjs-converter.js';
export {
  importFromMcp,
  exportToMcp,
  isMcpElicitationRequest,
  type McpElicitationSchema,
  type McpElicitationRequest,
  type McpProperty,
  type McpStringProp,
  type McpNumberProp,
  type McpBooleanProp,
  type McpArrayProp,
  type McpConstOption,
} from './lib/mcp.js';
