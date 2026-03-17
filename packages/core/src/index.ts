export {
  // Constants
  SCHEMA_TYPE,
  FIELD_TYPES,
  TEXT_INPUT_TYPES,
  EXPRESSION_DISPLAY_FORMATS,
  CONDITION_OPERATORS,
  CONDITIONAL_EFFECTS,
  NUMERIC_EXPRESSION_FORMATS,

  // Zod schemas
  fieldTypeSchema,
  textInputTypeSchema,
  expressionDisplayFormatSchema,
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
  type ExpressionDisplayFormat,
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
  type FormResponse,
  type SelectedOption,
  type FieldTypeMeta,
  type FieldTypeRegistry,
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

export {
  hydrateResponse,
  type HydratedResponseItem,
} from './lib/functions/hydrate-response.js';

export { evaluateCondition, evaluateRule, isExpressionValid } from './lib/logic/conditions.js';

export { resolveEffect } from './lib/logic/resolve.js';

export {
  validateField,
  validateForm,
  type ValidationError,
} from './lib/logic/validate.js';

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

export { applySheetDnd, type SheetDndDropDetail, getReorderDestinationIndex } from './lib/sheet-dnd.js';
