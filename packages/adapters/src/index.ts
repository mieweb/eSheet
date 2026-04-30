// =============================================================================
// @esheet/adapters - Convert external form schemas to eSheet FormDefinition
// =============================================================================

export {
  convertSurveyJS,
  convertSurveyJSToESheet,
  importFromSurveyJS,
  exportToSurveyJS,
  SURVEYJS_SYSTEM_PROMPT,
} from './lib/surveyjs-converter.js';
export {
  importFromMcp,
  exportToMcp,
  type McpElicitationSchema,
  type McpElicitationRequest,
  type McpProperty,
  type McpStringProp,
  type McpNumberProp,
  type McpBooleanProp,
  type McpArrayProp,
  type McpConstOption,
} from './lib/mcp.js';
