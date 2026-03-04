import { z } from 'zod/mini';

// ---------------------------------------------------------------------------
// Schema Version
// ---------------------------------------------------------------------------

/** Supported schema version identifier. */
export const SCHEMA_TYPE = 'mieforms-v1.0' as const;

export type SchemaType = typeof SCHEMA_TYPE;

// ---------------------------------------------------------------------------
// Field Types
// ---------------------------------------------------------------------------

/** All supported field type identifiers. */
export const FIELD_TYPES = [
  'text',
  'longtext',
  'multitext',
  'radio',
  'check',
  'boolean',
  'dropdown',
  'multiselectdropdown',
  'rating',
  'ranking',
  'slider',
  'singlematrix',
  'multimatrix',
  'image',
  'html',
  'signature',
  'diagram',
  'expression',
  'section',
] as const;

export const fieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof fieldTypeSchema>;

/** Category groupings for field types. */
export type FieldCategory =
  | 'text'
  | 'selection'
  | 'rating'
  | 'matrix'
  | 'rich'
  | 'organization';

/**
 * How a field stores its answer value.
 *
 * - `text`           — single string (`field.answer`)
 * - `selection`      — single option id (`field.selected: string`)
 * - `multiselection` — multiple option ids (`field.selected: string[]`)
 * - `multitext`      — per-option text (`field.options[].answer`)
 * - `matrix`         — row→column mapping (`field.selected: Record`)
 * - `media`          — binary/base64 data
 * - `display`        — no answer (presentational only)
 * - `container`      — no own answer (children hold answers)
 * - `none`           — unsupported / no answer
 */
export type AnswerType =
  | 'text'
  | 'selection'
  | 'multiselection'
  | 'multitext'
  | 'matrix'
  | 'media'
  | 'display'
  | 'container'
  | 'none';

// ---------------------------------------------------------------------------
// Input Types (for text field variants)
// ---------------------------------------------------------------------------

export const TEXT_INPUT_TYPES = [
  'string',
  'number',
  'email',
  'tel',
  'date',
  'datetime-local',
  'month',
  'time',
  'url',
] as const;

export const textInputTypeSchema = z.enum(TEXT_INPUT_TYPES);
export type TextInputType = z.infer<typeof textInputTypeSchema>;

// ---------------------------------------------------------------------------
// Expression Display Formats
// ---------------------------------------------------------------------------

export const EXPRESSION_DISPLAY_FORMATS = [
  'number',
  'currency',
  'percentage',
  'boolean',
  'string',
] as const;

export const expressionDisplayFormatSchema = z.enum(EXPRESSION_DISPLAY_FORMATS);
export type ExpressionDisplayFormat = z.infer<typeof expressionDisplayFormatSchema>;

/** Display formats that produce numeric results. */
export const NUMERIC_EXPRESSION_FORMATS: readonly ExpressionDisplayFormat[] = [
  'number',
  'currency',
  'percentage',
];

// ---------------------------------------------------------------------------
// Options (for choice / matrix fields)
// ---------------------------------------------------------------------------

/** A selectable option in a choice field (radio, check, dropdown, etc.). */
export const fieldOptionSchema = z.object({
  id: z.string(),
  value: z.string(),
  text: z.optional(z.string()),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

/** A row in a matrix field. */
export const matrixRowSchema = z.object({
  id: z.string(),
  value: z.string(),
});
export type MatrixRow = z.infer<typeof matrixRowSchema>;

/** A column in a matrix field. */
export const matrixColumnSchema = z.object({
  id: z.string(),
  value: z.string(),
});
export type MatrixColumn = z.infer<typeof matrixColumnSchema>;

// ---------------------------------------------------------------------------
// Conditional Logic (rules)
// ---------------------------------------------------------------------------

export type LogicMode = 'AND' | 'OR';

export const CONDITION_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'includes',
  'empty',
  'notEmpty',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
] as const;

export const conditionOperatorSchema = z.enum(CONDITION_OPERATORS);
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;

/** What effect a conditional rule has on the field. */
export const CONDITIONAL_EFFECTS = ['visible', 'enable', 'required'] as const;
export const conditionalEffectSchema = z.enum(CONDITIONAL_EFFECTS);
export type ConditionalEffect = z.infer<typeof conditionalEffectSchema>;

/** A single condition that evaluates a target field's response. */
export const conditionSchema = z.object({
  /** The field ID whose response is evaluated. */
  targetId: z.string(),
  /** Comparison operator. */
  operator: conditionOperatorSchema,
  /** The expected value to compare against. */
  expected: z.string(),
  /** Optional property accessor (e.g. 'length', 'count'). */
  propertyAccessor: z.optional(z.string()),
});
export type Condition = z.infer<typeof conditionSchema>;

/** A conditional rule that controls a field's behavior based on other fields' responses. */
export const conditionalRuleSchema = z.object({
  /** What effect this rule has on the field. */
  effect: conditionalEffectSchema,
  /** How multiple conditions are combined. */
  logic: z.enum(['AND', 'OR']),
  /** One or more conditions to evaluate. */
  conditions: z.array(conditionSchema),
});
export type ConditionalRule = z.infer<typeof conditionalRuleSchema>;

// ---------------------------------------------------------------------------
// Field Definition (structure only — no response values)
// ---------------------------------------------------------------------------

/**
 * A form field's structure and configuration.
 *
 * This is a "wide" schema — not every property is relevant to every
 * field type. Type-specific properties are optional and only meaningful
 * when matched with the corresponding `fieldType`.
 */
export const fieldDefinitionSchema: z.ZodMiniType<FieldDefinition> = z.object({
  /** Unique identifier within the form. */
  id: z.string(),
  /** Determines rendering and behavior. */
  fieldType: fieldTypeSchema,
  /** The question / label shown to the user (all types except section). */
  question: z.optional(z.string()),
  /** Whether a response is required. */
  required: z.optional(z.boolean()),
  /** Conditional rules that control visibility, enabled state, or required state. */
  rules: z.optional(z.array(conditionalRuleSchema)),

  // --- Text fields ---
  inputType: z.optional(textInputTypeSchema),
  unit: z.optional(z.string()),

  // --- Choice fields ---
  options: z.optional(z.array(fieldOptionSchema)),

  // --- Matrix fields ---
  rows: z.optional(z.array(matrixRowSchema)),
  columns: z.optional(z.array(matrixColumnSchema)),

  // --- Rich content ---
  htmlContent: z.optional(z.string()),
  imageUri: z.optional(z.string()),

  // --- Expression fields ---
  expression: z.optional(z.string()),
  displayFormat: z.optional(expressionDisplayFormatSchema),
  decimalPlaces: z.optional(z.number()),

  // --- Section (container) ---
  title: z.optional(z.string()),
  fields: z.optional(z.lazy(() => z.array(fieldDefinitionSchema))),

  // --- Adapter metadata ---
  _sourceData: z.optional(z.unknown()),
  _conversionWarnings: z.optional(z.array(z.unknown())),
});

/** A form field's structure and configuration. */
export interface FieldDefinition {
  id: string;
  fieldType: FieldType;
  question?: string;
  required?: boolean;
  rules?: ConditionalRule[];
  inputType?: TextInputType;
  unit?: string;
  options?: FieldOption[];
  rows?: MatrixRow[];
  columns?: MatrixColumn[];
  htmlContent?: string;
  imageUri?: string;
  expression?: string;
  displayFormat?: ExpressionDisplayFormat;
  decimalPlaces?: number;
  title?: string;
  fields?: FieldDefinition[];
  _sourceData?: unknown;
  _conversionWarnings?: unknown[];
}

// ---------------------------------------------------------------------------
// Field Response Values (answers only)
// ---------------------------------------------------------------------------

/** An option selection with both the ID and display value. */
export interface SelectedOption {
  /** The option ID. */
  readonly id: string;
  /** The human-readable display value. */
  value: string;
}

/**
 * Response values for a single field.
 *
 * The shape of the response depends on the field type — consumers
 * inspect which property is present (duck typing) rather than
 * checking `fieldType`.
 *
 * NOTE: Question text (`text`) is NOT stored here at runtime.
 * It lives in `FieldDefinition.question` and is joined at export
 * time (Phase 4) for human-readable output.
 */
export interface FieldResponse {
  /** Text answer (text, longtext, expression fields). */
  answer?: string;
  /**
   * Selected option(s).
   * - `SelectedOption` for single-select (radio, dropdown, boolean, rating, slider)
   * - `SelectedOption[]` for multi-select (check, multiselectdropdown, ranking)
   * - `Record<string, SelectedOption | SelectedOption[]>` for matrix (rowId → column(s))
   */
  selected?:
    | SelectedOption
    | SelectedOption[]
    | Record<string, SelectedOption | SelectedOption[]>;
  /** Per-option answer text for multitext fields. */
  multitextAnswers?: Record<string, string>;
  /** Serialized signature stroke data (signature field). */
  signatureData?: string;
  /** Base64 signature image (signature field). */
  signatureImage?: string;
  /** Serialized diagram stroke data (diagram field). */
  markupData?: string;
  /** Base64 diagram image (diagram field). */
  markupImage?: string;
}

// ---------------------------------------------------------------------------
// Form Schema (top-level definition)
// ---------------------------------------------------------------------------

/** A complete form definition (no response values). */
export const formDefinitionSchema = z.object({
  schemaType: z.literal(SCHEMA_TYPE),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  fields: z.array(fieldDefinitionSchema),
});
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

/** Pre-computed JSON Schema (Draft-07) for FormDefinition — used by builder's Monaco editor. */
export const formDefinitionJSONSchema: Record<string, unknown> =
  z.toJSONSchema(formDefinitionSchema) as Record<string, unknown>;

/** Response store — maps field IDs to their response values. */
export type FormResponse = Record<string, FieldResponse>;

// ---------------------------------------------------------------------------
// Field Type Metadata (registry data)
// ---------------------------------------------------------------------------

/** Static metadata describing a field type's capabilities. */
export interface FieldTypeMeta {
  /** Human-readable label (e.g. "Radio Button"). */
  label: string;
  /** UI category for grouping in the builder. */
  category: FieldCategory;
  /** How this field type stores its answer. */
  answerType: AnswerType;
  /** Whether the field has selectable options. */
  hasOptions: boolean;
  /** Whether the field uses a matrix (rows + columns). */
  hasMatrix: boolean;
  /** Default property values when creating a new field of this type. */
  defaultProps: Partial<FieldDefinition>;
  /** Placeholder strings keyed by input purpose (e.g. `{ question: '...', answer: '...' }`). */
  placeholder?: Record<string, string>;
  /** Number of starter options/rows the builder creates for a new field (defaults to 3 if hasOptions/hasMatrix). */
  defaultOptionCount?: number;
  /**
   * Constructor for the Web Component that renders this field type.
   * Set by renderer/builder packages via `registerFieldType()`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elementClass?: new (...args: any[]) => unknown;
}

/**
 * The field type registry — maps field type keys to their metadata.
 *
 * Uses `string` keys so consumers can register custom field types
 * beyond the 19 built-in ones.
 */
export type FieldTypeRegistry = Record<string, FieldTypeMeta>;
