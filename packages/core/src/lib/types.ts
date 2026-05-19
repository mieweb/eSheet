import { z } from 'zod/mini';

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
  'display',
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
// Options (for choice / matrix fields)
// ---------------------------------------------------------------------------

/** A selectable option in a choice field (radio, check, dropdown, etc.). */
export const fieldOptionSchema = z.object({
  id: z.string(),
  value: z.string(),
  text: z.optional(z.string()),
  /** Numeric score for scored surveys (PHQ-9, GAD-7, etc.). */
  score: z.optional(z.number()),
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
  /** Numeric score for scored surveys (PHQ-9, GAD-7, etc.). */
  score: z.optional(z.number()),
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

export const CONDITION_TYPES = ['field', 'expression'] as const;
export const conditionTypeSchema = z.enum(CONDITION_TYPES);
export type ConditionType = z.infer<typeof conditionTypeSchema>;

/** What effect a conditional rule has on the field. */
export const CONDITIONAL_EFFECTS = ['visible', 'enable', 'required'] as const;
export const conditionalEffectSchema = z.enum(CONDITIONAL_EFFECTS);
export type ConditionalEffect = z.infer<typeof conditionalEffectSchema>;

/** A single condition that evaluates a target field's response. */
export const conditionSchema = z.object({
  /** Condition source type. `field` uses target/operator/expected, `expression` uses expression text. */
  conditionType: z.optional(conditionTypeSchema),
  /** Optional expression string evaluated for expression conditions. */
  expression: z.optional(z.string()),
  /** The field ID whose response is evaluated. */
  targetId: z.optional(z.string()),
  /** Comparison operator. */
  operator: z.optional(conditionOperatorSchema),
  /** The expected value to compare against. */
  expected: z.optional(z.string()),
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
// Field Definition — Discriminated Union by fieldType
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Base Interfaces
// ---------------------------------------------------------------------------

/**
 * Properties shared by ALL field types.
 * Includes `question` and `required` for backward compatibility, even though
 * some field types (html, display) don't semantically use them.
 */
interface BaseFieldDefinition {
  /** Unique identifier within the form. */
  id: string;
  /** The question / label shown to the user. */
  question?: string;
  /** Whether a response is required. */
  required?: boolean;
  /** Conditional rules that control visibility, enabled state, or required state. */
  rules?: ConditionalRule[];
  /** Adapter metadata — original source data before conversion. */
  _sourceData?: unknown;
  /** Adapter metadata — warnings generated during conversion. */
  _conversionWarnings?: unknown[];
}

// ---------------------------------------------------------------------------
// Text Category
// ---------------------------------------------------------------------------

export interface TextFieldDefinition extends BaseFieldDefinition {
  fieldType: 'text';
  inputType?: TextInputType;
  unit?: string;
}

export interface LongtextFieldDefinition extends BaseFieldDefinition {
  fieldType: 'longtext';
  inputType?: TextInputType;
  unit?: string;
}

export interface MultitextFieldDefinition extends BaseFieldDefinition {
  fieldType: 'multitext';
  options?: FieldOption[];
}

// ---------------------------------------------------------------------------
// Selection Category
// ---------------------------------------------------------------------------

export interface RadioFieldDefinition extends BaseFieldDefinition {
  fieldType: 'radio';
  options?: FieldOption[];
}

export interface CheckFieldDefinition extends BaseFieldDefinition {
  fieldType: 'check';
  options?: FieldOption[];
}

export interface BooleanFieldDefinition extends BaseFieldDefinition {
  fieldType: 'boolean';
  options?: FieldOption[]; // Yes/No values
}

export interface DropdownFieldDefinition extends BaseFieldDefinition {
  fieldType: 'dropdown';
  options?: FieldOption[];
}

export interface MultiselectDropdownFieldDefinition
  extends BaseFieldDefinition {
  fieldType: 'multiselectdropdown';
  options?: FieldOption[];
}

// ---------------------------------------------------------------------------
// Rating Category
// ---------------------------------------------------------------------------

export interface RatingFieldDefinition extends BaseFieldDefinition {
  fieldType: 'rating';
  options?: FieldOption[];
}

export interface RankingFieldDefinition extends BaseFieldDefinition {
  fieldType: 'ranking';
  options?: FieldOption[];
}

export interface SliderFieldDefinition extends BaseFieldDefinition {
  fieldType: 'slider';
  options?: FieldOption[];
}

// ---------------------------------------------------------------------------
// Matrix Category
// ---------------------------------------------------------------------------

export interface SingleMatrixFieldDefinition extends BaseFieldDefinition {
  fieldType: 'singlematrix';
  rows?: MatrixRow[];
  columns?: MatrixColumn[];
  /** Enable auto-scoring (0, 1, 2, ... left to right). Individual column scores override. */
  scored?: boolean;
  /** Starting score value when scored=true (default: 0). */
  scoreStart?: number;
}

export interface MultiMatrixFieldDefinition extends BaseFieldDefinition {
  fieldType: 'multimatrix';
  rows?: MatrixRow[];
  columns?: MatrixColumn[];
  /** Enable auto-scoring (0, 1, 2, ... left to right). Individual column scores override. */
  scored?: boolean;
  /** Starting score value when scored=true (default: 0). */
  scoreStart?: number;
}

// ---------------------------------------------------------------------------
// Rich Category
// ---------------------------------------------------------------------------

export interface ImageFieldDefinition extends BaseFieldDefinition {
  fieldType: 'image';
  imageUri?: string;
  altText?: string;
  caption?: string;
}

export interface HtmlFieldDefinition extends BaseFieldDefinition {
  fieldType: 'html';
  htmlContent?: string;
  iframeHeight?: number;
}

export interface SignatureFieldDefinition extends BaseFieldDefinition {
  fieldType: 'signature';
  padPlaceholder?: string;
}

export interface DiagramFieldDefinition extends BaseFieldDefinition {
  fieldType: 'diagram';
  imageUri?: string; // background image
  padPlaceholder?: string;
}

export interface DisplayFieldDefinition extends BaseFieldDefinition {
  fieldType: 'display';
  /** Markdown-like content with inline expression placeholders. */
  content?: string;
}

// ---------------------------------------------------------------------------
// Organization Category
// ---------------------------------------------------------------------------

export interface SectionFieldDefinition extends BaseFieldDefinition {
  fieldType: 'section';
  title?: string;
  fields?: FieldDefinition[]; // recursive!
}

// ---------------------------------------------------------------------------
// Discriminated Union Type
// ---------------------------------------------------------------------------

/** A form field's structure and configuration (discriminated by fieldType). */
export type FieldDefinition =
  // Text
  | TextFieldDefinition
  | LongtextFieldDefinition
  | MultitextFieldDefinition
  // Selection
  | RadioFieldDefinition
  | CheckFieldDefinition
  | BooleanFieldDefinition
  | DropdownFieldDefinition
  | MultiselectDropdownFieldDefinition
  // Rating
  | RatingFieldDefinition
  | RankingFieldDefinition
  | SliderFieldDefinition
  // Matrix
  | SingleMatrixFieldDefinition
  | MultiMatrixFieldDefinition
  // Rich
  | ImageFieldDefinition
  | HtmlFieldDefinition
  | SignatureFieldDefinition
  | DiagramFieldDefinition
  | DisplayFieldDefinition
  // Organization
  | SectionFieldDefinition;

// ---------------------------------------------------------------------------
// Field Normalization (strips irrelevant properties by fieldType)
// ---------------------------------------------------------------------------

/** Properties allowed for each field type (beyond base properties). */
const FIELD_TYPE_PROPERTIES: Record<FieldType, readonly string[]> = {
  // Text category
  text: ['inputType', 'unit'],
  longtext: ['inputType', 'unit'],
  multitext: ['options'],
  // Selection category
  radio: ['options'],
  check: ['options'],
  boolean: ['options'],
  dropdown: ['options'],
  multiselectdropdown: ['options'],
  // Rating category
  rating: ['options'],
  ranking: ['options'],
  slider: ['options'],
  // Matrix category
  singlematrix: ['rows', 'columns'],
  multimatrix: ['rows', 'columns'],
  // Rich category
  image: ['imageUri', 'altText', 'caption'],
  html: ['htmlContent', 'iframeHeight'],
  signature: ['padPlaceholder'],
  diagram: ['imageUri', 'padPlaceholder'],
  display: ['content'],
  // Organization category
  section: ['title', 'fields'],
};

/** Base properties allowed on all field types. */
const BASE_PROPERTIES = [
  'id',
  'fieldType',
  'question',
  'required',
  'rules',
  '_sourceData',
  '_conversionWarnings',
] as const;

/**
 * Normalizes a field definition by stripping properties not relevant to its fieldType.
 * This is useful for cleaning AI-generated forms before strict validation.
 */
function normalizeFieldDefinition(
  field: Record<string, unknown>
): Record<string, unknown> {
  const fieldType = field['fieldType'] as FieldType | undefined;
  if (!fieldType || !(fieldType in FIELD_TYPE_PROPERTIES)) {
    return field; // Can't normalize without valid fieldType
  }

  const allowedProps = new Set<string>([
    ...BASE_PROPERTIES,
    ...FIELD_TYPE_PROPERTIES[fieldType],
  ]);

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(field)) {
    if (!allowedProps.has(key)) continue;

    // Recursively normalize nested fields (for sections)
    if (key === 'fields' && Array.isArray(value)) {
      normalized[key] = value.map((f) =>
        normalizeFieldDefinition(f as Record<string, unknown>)
      );
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Normalizes a form definition by stripping properties not relevant to each field's fieldType.
 * Use this to clean AI-generated forms before validation.
 *
 * @example
 * ```ts
 * const rawForm = JSON.parse(aiResponse);
 * const normalizedForm = normalizeFormDefinition(rawForm);
 * const result = formDefinitionSchema.safeParse(normalizedForm);
 * ```
 */
export function normalizeFormDefinition(
  form: unknown
): Record<string, unknown> {
  // Handle null, undefined, or non-object inputs gracefully
  if (form === null || form === undefined || typeof form !== 'object') {
    return {}; // Return empty object - Zod will report validation errors
  }

  const formObj = form as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  // Copy top-level form properties
  const allowedFormProps = [
    'id',
    'title',
    'description',
    'fields',
    '_sourceData',
  ];
  for (const key of allowedFormProps) {
    if (key in formObj) {
      if (key === 'fields' && Array.isArray(formObj[key])) {
        result[key] = (formObj[key] as Record<string, unknown>[]).map((f) =>
          normalizeFieldDefinition(f)
        );
      } else {
        result[key] = formObj[key];
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Zod Schemas for Discriminated Union
// ---------------------------------------------------------------------------

/**
 * Base schema properties shared by all field types.
 * Includes `question` and `required` for backward compatibility.
 */
const baseFieldProps = {
  id: z.string(),
  question: z.optional(z.string()),
  required: z.optional(z.boolean()),
  rules: z.optional(z.array(conditionalRuleSchema)),
  _sourceData: z.optional(z.unknown()),
  _conversionWarnings: z.optional(z.array(z.unknown())),
};

// Text category schemas
const textFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('text'),
  inputType: z.optional(textInputTypeSchema),
  unit: z.optional(z.string()),
});

const longtextFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('longtext'),
  inputType: z.optional(textInputTypeSchema),
  unit: z.optional(z.string()),
});

const multitextFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('multitext'),
  options: z.optional(z.array(fieldOptionSchema)),
});

// Selection category schemas
const radioFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('radio'),
  options: z.optional(z.array(fieldOptionSchema)),
});

const checkFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('check'),
  options: z.optional(z.array(fieldOptionSchema)),
});

const booleanFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('boolean'),
  options: z.optional(z.array(fieldOptionSchema)),
});

const dropdownFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('dropdown'),
  options: z.optional(z.array(fieldOptionSchema)),
});

const multiselectDropdownFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('multiselectdropdown'),
  options: z.optional(z.array(fieldOptionSchema)),
});

// Rating category schemas
const ratingFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('rating'),
  options: z.optional(z.array(fieldOptionSchema)),
});

const rankingFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('ranking'),
  options: z.optional(z.array(fieldOptionSchema)),
});

const sliderFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('slider'),
  options: z.optional(z.array(fieldOptionSchema)),
});

// Matrix category schemas
const singleMatrixFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('singlematrix'),
  rows: z.optional(z.array(matrixRowSchema)),
  columns: z.optional(z.array(matrixColumnSchema)),
});

const multiMatrixFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('multimatrix'),
  rows: z.optional(z.array(matrixRowSchema)),
  columns: z.optional(z.array(matrixColumnSchema)),
});

// Rich category schemas
const imageFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('image'),
  imageUri: z.optional(z.string()),
  altText: z.optional(z.string()),
  caption: z.optional(z.string()),
});

const htmlFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('html'),
  htmlContent: z.optional(z.string()),
  iframeHeight: z.optional(z.number()),
});

const signatureFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('signature'),
  padPlaceholder: z.optional(z.string()),
});

const diagramFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('diagram'),
  imageUri: z.optional(z.string()),
  padPlaceholder: z.optional(z.string()),
});

const displayFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('display'),
  content: z.optional(z.string()),
});

// Section schema (recursive via z.lazy)
// Note: We need to cast this to handle the recursive type reference
const sectionFieldSchema = z.strictObject({
  ...baseFieldProps,
  fieldType: z.literal('section'),
  title: z.optional(z.string()),
  fields: z.optional(
    z.lazy(
      (): z.ZodMiniType<FieldDefinition[]> => z.array(fieldDefinitionSchema)
    )
  ),
});

/** Zod schema for FieldDefinition discriminated union. */
export const fieldDefinitionSchema = z.discriminatedUnion('fieldType', [
  // Text
  textFieldSchema,
  longtextFieldSchema,
  multitextFieldSchema,
  // Selection
  radioFieldSchema,
  checkFieldSchema,
  booleanFieldSchema,
  dropdownFieldSchema,
  multiselectDropdownFieldSchema,
  // Rating
  ratingFieldSchema,
  rankingFieldSchema,
  sliderFieldSchema,
  // Matrix
  singleMatrixFieldSchema,
  multiMatrixFieldSchema,
  // Rich
  imageFieldSchema,
  htmlFieldSchema,
  signatureFieldSchema,
  diagramFieldSchema,
  displayFieldSchema,
  // Organization
  sectionFieldSchema,
]);

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
  /** Text answer (text and longtext fields). */
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
  /** Set to true when the response was filled programmatically by an AI agent. */
  _ai?: boolean;
}

// ---------------------------------------------------------------------------
// Form Schema (top-level definition)
// ---------------------------------------------------------------------------

/** A complete form definition (no response values). */
export const formDefinitionSchema = z.strictObject({
  id: z.string(),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  fields: z.array(fieldDefinitionSchema),
  _sourceData: z.optional(z.unknown()),
});
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

// ---------------------------------------------------------------------------
// JSON Schema (OpenAI Structured Outputs compatible)
// ---------------------------------------------------------------------------

type JsonSchemaObject = Record<string, unknown>;

/**
 * Check if a value is an empty object (no type key).
 * zod's z.unknown() produces `{}` which is invalid for OpenAI strict mode.
 */
function isEmptySchema(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

/**
 * Check if a schema object represents an array of unknown items.
 * e.g., { type: "array", items: {} }
 */
function isArrayOfUnknown(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as JsonSchemaObject;
  return (
    obj['type'] === 'array' &&
    typeof obj['items'] === 'object' &&
    isEmptySchema(obj['items'])
  );
}

/**
 * Recursively process JSON Schema for OpenAI Structured Outputs compatibility:
 * 1. Makes all properties required (OpenAI requires this)
 * 2. Removes internal adapter fields (properties starting with `_`)
 * 3. Removes properties with empty schemas (z.unknown() produces {})
 */
function makeOpenAICompatible(schema: JsonSchemaObject): JsonSchemaObject {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result: JsonSchemaObject = { ...schema };

  // Process properties: remove internal fields and empty schemas
  if (result['properties'] && typeof result['properties'] === 'object') {
    const props = result['properties'] as JsonSchemaObject;
    const cleanedProps: JsonSchemaObject = {};

    for (const [key, value] of Object.entries(props)) {
      // Skip internal fields (prefixed with _)
      if (key.startsWith('_')) continue;
      // Skip empty schemas (z.unknown() produces {})
      if (isEmptySchema(value)) continue;
      // Skip arrays of unknown items
      if (isArrayOfUnknown(value)) continue;

      cleanedProps[key] = makeOpenAICompatible(value as JsonSchemaObject);
    }

    result['properties'] = cleanedProps;
    // All remaining properties must be required
    result['required'] = Object.keys(cleanedProps);
  }

  // Process items in arrays
  if (result['items'] && typeof result['items'] === 'object') {
    result['items'] = makeOpenAICompatible(result['items'] as JsonSchemaObject);
  }

  // Process $defs
  if (result['$defs'] && typeof result['$defs'] === 'object') {
    const defs = result['$defs'] as JsonSchemaObject;
    result['$defs'] = Object.fromEntries(
      Object.entries(defs).map(([key, value]) => [
        key,
        makeOpenAICompatible(value as JsonSchemaObject),
      ])
    );
  }

  // Process anyOf/oneOf/allOf
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as JsonSchemaObject[]).map((item) =>
        makeOpenAICompatible(item)
      );
    }
  }

  return result;
}

/** Pre-computed JSON Schema (Draft-07) for FormDefinition — used by builder's Monaco editor. */
export const formDefinitionJSONSchema: Record<string, unknown> =
  makeOpenAICompatible(
    z.toJSONSchema(formDefinitionSchema) as JsonSchemaObject
  );

/** Response store — maps field IDs to their response values. */
export type FieldResponseMap = Record<string, FieldResponse>;

// ---------------------------------------------------------------------------
// Submission / Envelope Types
// ---------------------------------------------------------------------------

/** A ranked item with its 1-based position. */
export type RankedAnswer = {
  id: string;
  value: string;
  rank: number;
};

/** A structured media attachment (signature / diagram). */
export type AttachmentAnswer = {
  contentType: string;
  dataUrl?: string;
  url?: string;
  title?: string;
};

/** All possible answer value shapes in a submission payload. */
export type AnswerValue =
  | string
  | number
  | boolean
  | null
  | { id: string; value: string }
  | Array<{ id: string; value: string }>
  | RankedAnswer[]
  | ResponseItem[]
  | AttachmentAnswer
  | Record<string, SelectedOption | SelectedOption[]>;

/** A single item in the submission payload — one per answerable field. */
export interface ResponseItem {
  id: string;
  text?: string;
  answer?: AnswerValue;
}

export const RESPONSE_STATUSES = [
  'draft',
  'in-progress',
  'completed',
  'amended',
] as const;

export const responseStatusSchema = z.enum(RESPONSE_STATUSES);
export type ResponseStatus = z.infer<typeof responseStatusSchema>;

/** Top-level submission envelope wrapping all answers. */
export interface FormResponse {
  id: string;
  definitionRef: {
    id: string;
    version?: string;
  };
  status?: ResponseStatus;
  subjectRef?: {
    type: string;
    id: string;
  };
  authoredAt?: string;
  items: ResponseItem[];
}

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
  defaultProps: Record<string, unknown>;
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
