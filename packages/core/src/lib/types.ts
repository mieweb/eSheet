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

export type FieldType = (typeof FIELD_TYPES)[number];

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

export type TextInputType =
  | 'string'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'time'
  | 'url';

// ---------------------------------------------------------------------------
// Expression Display Formats
// ---------------------------------------------------------------------------

export type ExpressionDisplayFormat =
  | 'number'
  | 'currency'
  | 'percentage'
  | 'boolean'
  | 'string';

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
export interface FieldOption {
  readonly id: string;
  value: string;
  text?: string;
}

/** A row in a matrix field. */
export interface MatrixRow {
  readonly id: string;
  value: string;
}

/** A column in a matrix field. */
export interface MatrixColumn {
  readonly id: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Conditional Logic (rules)
// ---------------------------------------------------------------------------

export type LogicMode = 'AND' | 'OR';

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'includes'
  | 'empty'
  | 'notEmpty'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

/** What effect a conditional rule has on the field. */
export type ConditionalEffect = 'visible' | 'enable' | 'required';

/** A single condition that evaluates a target field's response. */
export interface Condition {
  /** The field ID whose response is evaluated. */
  targetId: string;
  /** Comparison operator. */
  operator: ConditionOperator;
  /** The expected value to compare against (option ID for choice fields, text for text fields). */
  expected: string;
  /** Optional property accessor (e.g. 'length', 'count'). */
  propertyAccessor?: string;
}

/** A conditional rule that controls a field's behavior based on other fields' responses. */
export interface ConditionalRule {
  /** What effect this rule has on the field. */
  effect: ConditionalEffect;
  /** How multiple conditions are combined. */
  logic: LogicMode;
  /** One or more conditions to evaluate. */
  conditions: Condition[];
}

// ---------------------------------------------------------------------------
// Field Definition (structure only — no response values)
// ---------------------------------------------------------------------------

/**
 * A form field's structure and configuration.
 *
 * This is a "wide" interface — not every property is relevant to every
 * field type. Type-specific properties are optional and only meaningful
 * when matched with the corresponding `fieldType`.
 */
export interface FieldDefinition {
  /** Unique identifier within the form. */
  id: string;
  /** Determines rendering and behavior. */
  fieldType: FieldType;
  /** The question / label shown to the user (all types except section). */
  question?: string;
  /** Whether a response is required (can be overridden by a 'required' conditional rule). */
  required?: boolean;
  /** Conditional rules that control visibility, enabled state, or required state. */
  rules?: ConditionalRule[];

  // --- Text fields ---
  /** HTML input type variant (text field only). */
  inputType?: TextInputType;
  /** Unit label shown beside the input (text field only). */
  unit?: string;

  // --- Choice fields (radio, check, dropdown, rating, ranking, slider, multitext) ---
  /** Available options to choose from. */
  options?: FieldOption[];

  // --- Matrix fields (singlematrix, multimatrix) ---
  /** Row definitions for matrix fields. */
  rows?: MatrixRow[];
  /** Column definitions for matrix fields. */
  columns?: MatrixColumn[];

  // --- Rich content ---
  /** Raw HTML content (html field). */
  htmlContent?: string;
  /** Image URI (image field). */
  imageUri?: string;

  // --- Expression fields ---
  /** Expression formula, e.g. `"{field1} + {field2}"`. */
  expression?: string;
  /** How the expression result is formatted. */
  displayFormat?: ExpressionDisplayFormat;
  /** Number of decimal places for numeric formats. */
  decimalPlaces?: number;

  // --- Section (container) ---
  /** Section title (used instead of `question`). */
  title?: string;
  /** Nested child fields (section only). */
  fields?: FieldDefinition[];

  // --- Adapter metadata (not user-facing) ---
  /** Original source data preserved by schema adapter. */
  _sourceData?: unknown;
  /** Warnings generated during schema conversion. */
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
export interface FormDefinition {
  /** Schema version identifier. */
  schemaType: SchemaType;
  /** Form title. */
  title?: string;
  /** Form description. */
  description?: string;
  /** Ordered list of top-level fields. */
  fields: FieldDefinition[];
}

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
