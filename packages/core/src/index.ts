export {
  // Constants
  SCHEMA_TYPE,
  FIELD_TYPES,
  NUMERIC_EXPRESSION_FORMATS,

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

export {
  evaluateCondition,
  evaluateRule,
} from './lib/logic/conditions.js';

export { resolveEffect } from './lib/logic/resolve.js';

export {
  validateField,
  validateForm,
  type ValidationError,
} from './lib/logic/validate.js';

export {
  createFormEngine,
  type FormEngineState,
  type FormEngine,
  type AddFieldOptions,
} from './lib/engine/store.js';
