export {
  // Constants
  SCHEMA_TYPE,
  FIELD_TYPES,
  TEXT_INPUT_TYPES,
  CONDITION_OPERATORS,
  CONDITIONAL_EFFECTS,

  // Zod schemas
  fieldTypeSchema,
  textInputTypeSchema,
  fieldOptionSchema,
  matrixRowSchema,
  matrixColumnSchema,
  conditionOperatorSchema,
  conditionalEffectSchema,
  conditionSchema,
  conditionalRuleSchema,
  fieldDefinitionSchema,
  formDefinitionSchema,
  formDefinitionJSONSchema,

  // Types
  type SchemaType,
  type FieldType,
  type FieldCategory,
  type AnswerType,
  type TextInputType,
  type FieldOption,
  type MatrixRow,
  type MatrixColumn,
  type LogicMode,
  type ConditionOperator,
  type ConditionalEffect,
  type Condition,
  type ConditionalRule,
  type FieldDefinition,
  type FieldResponse,
  type FormDefinition,
  type FieldResponseMap as FormResponse,
  type SelectedOption,
  type FieldTypeMeta,
  type FieldTypeRegistry,
  type RankedAnswer,
  type AttachmentAnswer,
  type AnswerValue,
  type ResponseItem,
  type FormResponse as FormResponseEnvelope,
} from './lib/types.js';

export {
  registerFieldType,
  getFieldTypeMeta,
  getRegisteredFieldTypes,
  resetFieldTypeRegistry,
  registerFieldElements,
} from './lib/registry.js';

export {
  generateFieldId,
  generateOptionId,
  generateRowId,
  generateColumnId,
} from './lib/functions/ids.js';

export {
  normalizeDefinition,
  hydrateDefinition,
  type FieldNode,
  type NormalizedDefinition,
} from './lib/functions/normalize.js';

export { hydrateResponse } from './lib/functions/hydrate-response.js';

export {
  evaluateCondition,
  evaluateRule,
  isExpressionValid,
  evaluateExpression,
} from './lib/logic/conditions.js';

export { resolveEffect } from './lib/logic/resolve.js';

export {
  validateField,
  validateForm,
  type ValidationError,
} from './lib/logic/validate.js';

export { formatZodValidationError } from './lib/zod-errors.js';

export {
  createFormStore,
  type FormState,
  type FormStore,
  type AddFieldOptions,
} from './lib/stores/form-store.js';

export {
  createUIStore,
  type UIState,
  type UIStore,
  type BuilderMode,
  type EditTab,
} from './lib/stores/ui-store.js';

export { type FieldComponentProps } from './lib/field-component-props.js';
