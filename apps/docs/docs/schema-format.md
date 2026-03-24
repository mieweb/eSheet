---
sidebar_position: 5
---

# Schema Format

eSheet uses a JSON schema format identified by `schemaType: 'mieforms-v1.0'`. This page documents the complete structure.

## Form Definition

The top-level object that describes an entire form:

```typescript
interface FormDefinition {
  /** Schema version -- always 'mieforms-v1.0' */
  schemaType: 'mieforms-v1.0';
  /** Optional form title */
  title?: string;
  /** Optional form description */
  description?: string;
  /** Array of field definitions */
  fields: FieldDefinition[];
}
```

### Example

```json
{
  "schemaType": "mieforms-v1.0",
  "title": "Patient Intake Form",
  "description": "Please fill out all required fields",
  "fields": [
    {
      "id": "name",
      "fieldType": "text",
      "question": "Full Name",
      "required": true,
      "inputType": "string"
    },
    {
      "id": "dob",
      "fieldType": "text",
      "question": "Date of Birth",
      "inputType": "date"
    }
  ]
}
```

## Field Definition

Every field in a form is described by a `FieldDefinition`. This is a "wide" schema -- not every property applies to every field type.

```typescript
interface FieldDefinition {
  /** Unique identifier within the form */
  id: string;
  /** Determines rendering and behavior */
  fieldType: FieldType;
  /** The question/label shown to the user */
  question?: string;
  /** Whether a response is required */
  required?: boolean;
  /** Conditional rules (see Conditional Logic) */
  rules?: ConditionalRule[];

  // --- Text fields ---
  /** Input type variant for text fields */
  inputType?: TextInputType;
  /** Unit suffix displayed after the input (e.g. "kg", "cm") */
  unit?: string;

  // --- Choice fields ---
  /** Options for radio, check, dropdown, multiselect, multitext, rating, ranking */
  options?: FieldOption[];

  // --- Matrix fields ---
  /** Rows for singlematrix and multimatrix */
  rows?: MatrixRow[];
  /** Columns for singlematrix and multimatrix */
  columns?: MatrixColumn[];

  // --- Rich content ---
  /** Raw HTML content for html fields */
  htmlContent?: string;
  /** Image URI for image fields */
  imageUri?: string;
  /** Alt text for image fields */
  altText?: string;
  /** Caption for image fields */
  caption?: string;
  /** Placeholder text on the drawing canvas (signature/diagram) */
  padPlaceholder?: string;
  /** Markdown-like content for display fields (supports expression interpolation) */
  content?: string;

  // --- Section (container) ---
  /** Section title */
  title?: string;
  /** Nested child fields */
  fields?: FieldDefinition[];
}
```

## Field Types

The 19 built-in field types:

| Field Type | Category | Answer Type | Has Options | Has Matrix | Description |
|---|---|---|---|---|---|
| `text` | text | `text` | No | No | Single-line text input with variants |
| `longtext` | text | `text` | No | No | Multi-line textarea |
| `multitext` | text | `multitext` | Yes | No | One text input per option |
| `radio` | selection | `selection` | Yes | No | Single-select radio buttons |
| `check` | selection | `multiselection` | Yes | No | Multi-select checkboxes |
| `boolean` | selection | `selection` | No | No | Yes/No toggle |
| `dropdown` | selection | `selection` | Yes | No | Single-select dropdown |
| `multiselectdropdown` | selection | `multiselection` | Yes | No | Multi-select dropdown |
| `rating` | rating | `selection` | Yes | No | Numeric scale (1-5, 1-10) |
| `ranking` | rating | `multiselection` | Yes | No | Drag-to-order items |
| `slider` | rating | `selection` | Yes | No | Range slider |
| `singlematrix` | matrix | `matrix` | No | Yes | One selection per row |
| `multimatrix` | matrix | `matrix` | No | Yes | Multiple selections per row |
| `image` | rich | `display` | No | No | Image display |
| `html` | rich | `display` | No | No | Raw HTML embed |
| `signature` | rich | `media` | No | No | Drawing pad for signatures |
| `diagram` | rich | `media` | No | No | Drawing pad for markup |
| `display` | rich | `display` | No | No | Markdown + expression content |
| `section` | organization | `container` | No | No | Container for nested fields |

## Text Input Types

The `text` field supports these input type variants via the `inputType` property:

| Input Type | HTML Type | Description |
|---|---|---|
| `string` | `text` | Plain text (default) |
| `number` | `number` | Numeric input |
| `email` | `email` | Email address |
| `tel` | `tel` | Phone number (auto-formatted) |
| `date` | `date` | Date picker |
| `datetime-local` | `datetime-local` | Date and time picker |
| `month` | `month` | Month picker |
| `time` | `time` | Time picker |
| `url` | `url` | URL input |

## Options

Choice fields use `FieldOption` objects:

```typescript
interface FieldOption {
  /** Unique option identifier */
  id: string;
  /** Display value */
  value: string;
  /** Optional tooltip or auxiliary text */
  text?: string;
}
```

## Matrix Dimensions

Matrix fields use rows and columns:

```typescript
interface MatrixRow {
  id: string;
  value: string;  // Row label
}

interface MatrixColumn {
  id: string;
  value: string;  // Column header
}
```

## Form Response

The response for a submitted form:

```typescript
/** Maps field IDs to their response values */
type FormResponse = Record<string, FieldResponse>;

interface FieldResponse {
  /** Text answer (text, longtext) */
  answer?: string;
  /**
   * Selected option(s):
   * - SelectedOption for single-select (radio, dropdown, boolean, rating, slider)
   * - SelectedOption[] for multi-select (check, multiselectdropdown, ranking)
  * - Record<string, SelectedOption | SelectedOption[]> for matrix (rowId -> column)
   */
  selected?:
    | SelectedOption
    | SelectedOption[]
    | Record<string, SelectedOption | SelectedOption[]>;
  /** Per-option text for multitext fields */
  multitextAnswers?: Record<string, string>;
  /** Serialized stroke data (signature) */
  signatureData?: string;
  /** Base64 PNG image (signature) */
  signatureImage?: string;
  /** Serialized stroke data (diagram) */
  markupData?: string;
  /** Base64 PNG image (diagram) */
  markupImage?: string;
}

interface SelectedOption {
  readonly id: string;
  value: string;
}
```

### Example Response

```json
{
  "name": { "answer": "Jane Doe" },
  "email": { "answer": "jane@example.com" },
  "reason": { "selected": { "id": "opt2", "value": "Follow-up" } },
  "symptoms": {
    "selected": [
      { "id": "s1", "value": "Headache" },
      { "id": "s3", "value": "Fatigue" }
    ]
  },
  "pain_matrix": {
    "selected": {
      "row_head": { "id": "col_mild", "value": "Mild" },
      "row_back": { "id": "col_severe", "value": "Severe" }
    }
  },
  "signature_field": {
    "signatureData": "[{\"points\":[...]}]",
    "signatureImage": "data:image/png;base64,..."
  }
}
```
