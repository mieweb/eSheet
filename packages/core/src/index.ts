export {
  // Constants
  FIELD_TYPES,
  TEXT_INPUT_TYPES,
  CONDITION_OPERATORS,
  CONDITIONAL_EFFECTS,
  VALIDATOR_TYPES,

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
  fieldValidatorSchema,
  fieldDefinitionSchema,
  formDefinitionSchema,
  getFormDefinitionJSONSchema,

  // Types
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
  type ValidatorType,
  type FieldValidator,
  type FieldDefinition,
  type FieldWidth,
  type OptionLayout,
  type RelativeDateRange,
  type OptionBearingFieldDefinition,
  hasOptions,
  // Per-field-type interfaces (discriminated union members)
  type TextFieldDefinition,
  type LongtextFieldDefinition,
  type MultitextFieldDefinition,
  type RadioFieldDefinition,
  type CheckFieldDefinition,
  type BooleanFieldDefinition,
  type DropdownFieldDefinition,
  type MultiselectDropdownFieldDefinition,
  type OpenChoiceFieldDefinition,
  type RatingFieldDefinition,
  type RankingFieldDefinition,
  type SliderFieldDefinition,
  type SingleMatrixFieldDefinition,
  type MultiMatrixFieldDefinition,
  type ImageFieldDefinition,
  type FileFieldDefinition,
  type HtmlFieldDefinition,
  type SignatureFieldDefinition,
  type DiagramFieldDefinition,
  type DisplayFieldDefinition,
  type SectionFieldDefinition,
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
  registerFieldElements,
  // NOTE: resetFieldTypeRegistry intentionally not exported - internal/test-only
} from './lib/registry.js';

export {
  generateFieldId,
  generateOptionId,
  generateRowId,
  generateColumnId,
  slugifyQuestion,
} from './lib/functions/ids.js';

export {
  normalizeDefinition,
  hydrateDefinition,
  type FieldNode,
  type NormalizedDefinition,
  type NormalizedPage,
} from './lib/functions/normalize.js';

export { hydrateResponse } from './lib/functions/hydrate-response.js';

export {
  normalizeResponses,
  extractResponseValue,
} from './lib/functions/normalize-responses.js';

export {
  evaluateCondition,
  evaluateRule,
  isExpressionValid,
  evaluateExpression,
  evaluateJsExpression,
  normalizeExpression,
} from './lib/logic/conditions.js';

export {
  resolveEffect,
  resolveSetValue,
  resolveRequiredSeverity,
} from './lib/logic/resolve.js';

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

export {
  type FieldComponentProps,
  type FieldPresence,
  type FieldProposal,
  type CollabDecorations,
} from './lib/field-component-props.js';

export {
  buildRenderTree,
  applyComputedValues,
  type RenderFieldNode,
  type RenderTreeOptions,
} from './lib/functions/render-tree.js';
