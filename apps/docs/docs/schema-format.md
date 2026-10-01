---
sidebar_position: 5
---

# Schema Format

eSheet's `FormDefinition` model is JSON-shaped and identified by the `id` field. **YAML is the canonical on-disk representation** for committed form layouts, while JSON is the wire/API representation. Both formats parse to the same model and are accepted by the builder and renderer. This page documents the complete structure.

## Which format should I commit?

Commit form layouts as `*.esheet.yaml`. YAML keeps diffs reviewable, supports comments, and preserves readable multi-line strings. The builder's Export action uses YAML by default.

Use `*.esheet.json` when a downstream system requires JSON, or when sending a definition over an API. Existing `.esheet.json` layouts remain supported indefinitely; no migration is required.

## Form Definition

The top-level object that describes an entire form:

```typescript
interface FormDefinition {
  /** Unique form identifier */
  id: string;
  /** Optional form title */
  title?: string;
  /** Optional form description */
  description?: string;
  /** Optional Handlebars Markdown body for response export */
  outputTemplate?: string;
  /** When true, enables dangerously embedded JS for calculations and conditions */
  dangerouslyAllowJS?: boolean;
  /** Pages — every form has at least one page; fields live inside pages */
  pages: PageEntry[];
}

interface PageEntry {
  /** Unique page identifier */
  id: string;
  /** Optional display title (shown as tab label in the builder) */
  title?: string;
  /**
   * Reserved: automatically advance to the next page when all fields are answered.
   * Not yet active in the renderer.
   */
  autoAdvance?: boolean;
  /** Fields rendered on this page */
  fields?: FieldDefinition[];
}
```

A form with a **single page** renders as a normal single-scroll form — no navigation UI is shown. A form with **multiple pages** shows a Previous / N of total / Next navigation bar in the renderer. See [Pages](/docs/field-types/pages) for full details.

### Example

```yaml
id: patient-intake-form
title: Patient Intake Form
description: Please fill out all required fields
pages:
  - id: page_1
    title: Demographics
    fields:
      # Collect identity information before asking health questions.
      - id: name
        fieldType: text
        question: Full Name
        required: true
        inputType: string
      - id: dob
        fieldType: text
        question: Date of Birth
        inputType: date
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
  /** Shows the value but rejects user edits; programmatic writes still apply */
  readOnly?: boolean;
  /** Conditional rules (see Conditional Logic) */
  rules?: ConditionalRule[];
  /** Width occupied by the field in the layout grid */
  width?: FieldWidth;

  // --- Text fields ---
  /** Input type variant for text fields */
  inputType?: TextInputType;
  /** Unit suffix displayed after the input (e.g. "kg", "cm") */
  unit?: string;

  // --- Choice fields ---
  /** Options for radio, check, dropdown, multiselect, multitext, rating, ranking */
  options?: FieldOption[];
  /** Layout direction for fields that display options */
  optionLayout?: OptionLayout;

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

## Field Layout

### FieldWidth

The optional `width` property controls how much of a row a field occupies:

| Value   | Description               |
| ------- | ------------------------- |
| `full`  | Uses the full row width   |
| `half`  | Uses half of the row      |
| `third` | Uses one third of the row |

Text, selection, and rating fields default to `third`. Rich, matrix, and
organization fields default to `full`.

```ts
type FieldWidth = 'full' | 'half' | 'third';
```

### OptionLayout

The optional `optionLayout` property controls how a field's options are
arranged:

| Value   | Description                                         |
| ------- | --------------------------------------------------- |
| `stack` | Displays one option per line                        |
| `wrap`  | Displays options horizontally and wraps as required |

Fields that support `optionLayout` default to `wrap`.

```ts
type OptionLayout = 'stack' | 'wrap';
```

## Field Types

The 19 built-in field types:

| Field Type            | Category     | Answer Type      | Has Options | Has Matrix | Description                          |
| --------------------- | ------------ | ---------------- | ----------- | ---------- | ------------------------------------ |
| `text`                | text         | `text`           | No          | No         | Single-line text input with variants |
| `longtext`            | text         | `text`           | No          | No         | Multi-line textarea                  |
| `multitext`           | text         | `multitext`      | Yes         | No         | One text input per option            |
| `radio`               | selection    | `selection`      | Yes         | No         | Single-select radio buttons          |
| `check`               | selection    | `multiselection` | Yes         | No         | Multi-select checkboxes              |
| `boolean`             | selection    | `selection`      | No          | No         | Yes/No toggle                        |
| `dropdown`            | selection    | `selection`      | Yes         | No         | Single-select dropdown               |
| `multiselectdropdown` | selection    | `multiselection` | Yes         | No         | Multi-select dropdown                |
| `rating`              | rating       | `selection`      | Yes         | No         | Numeric scale (1-5, 1-10)            |
| `ranking`             | rating       | `multiselection` | Yes         | No         | Drag-to-order items                  |
| `slider`              | rating       | `selection`      | Yes         | No         | Range slider                         |
| `singlematrix`        | matrix       | `matrix`         | No          | Yes        | One selection per row                |
| `multimatrix`         | matrix       | `matrix`         | No          | Yes        | Multiple selections per row          |
| `image`               | rich         | `display`        | No          | No         | Image display                        |
| `html`                | rich         | `display`        | No          | No         | Raw HTML embed                       |
| `signature`           | rich         | `media`          | No          | No         | Drawing pad for signatures           |
| `diagram`             | rich         | `media`          | No          | No         | Drawing pad for markup               |
| `display`             | rich         | `display`        | No          | No         | Markdown + expression content        |
| `section`             | organization | `container`      | No          | No         | Container for nested fields          |

## Text Input Types

The `text` field supports these input type variants via the `inputType` property:

| Input Type       | HTML Type        | Description                   |
| ---------------- | ---------------- | ----------------------------- |
| `string`         | `text`           | Plain text (default)          |
| `number`         | `number`         | Numeric input                 |
| `email`          | `email`          | Email address                 |
| `tel`            | `tel`            | Phone number (auto-formatted) |
| `date`           | `date`           | Date picker                   |
| `datetime-local` | `datetime-local` | Date and time picker          |
| `month`          | `month`          | Month picker                  |
| `time`           | `time`           | Time picker                   |
| `url`            | `url`            | URL input                     |

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
  /** Optional numeric score for scored surveys (e.g. PHQ-9, GAD-7). When present on
   * any option, the field's answer value is the sum of scores for all selected options. */
  score?: number;
  /** Conditional visibility rules for this option. Only the `visible` effect applies. */
  rules?: ConditionalRule[];
}
```

## Matrix Dimensions

Matrix fields use rows and columns:

```typescript
interface MatrixRow {
  id: string;
  value: string; // Row label
}

interface MatrixColumn {
  id: string;
  value: string; // Column header
  /** Optional numeric score for this column. Overrides auto-scoring when `scored` is enabled. */
  score?: number;
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

Responses are wire/API payloads, so this example is shown in JSON. Form definitions above use YAML as the canonical committed format.

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

## Response document export

`exportResponse(form, response, options?)` from `@esheet/adapters` asynchronously
returns `{ mdy, markdown, diagnostics }`. It accepts the `FormResponse` field-ID
map above, not a submission envelope.

- **`mdy` is the canonical full form-plus-response document:** YAML front matter
  contains the complete supplied `form` and `response`, followed by the rendered
  Markdown body. Metadata under `mdy` records `kind: document`, `schema: esheet`,
  `renderedAt`, and, when used, the template name (form ID), engine, and source.
- **`markdown` is the body only:** no YAML front matter or full structured data.
  Use this value for display, Markdown download, or HTML conversion.
- **`diagnostics` is an array of `{ code, fieldId? }`:** warnings can accompany a
  successful export. Invalid input or templates reject the promise instead.

**Export is not redaction.** Hidden answers, orphan response entries (IDs absent
from the definition), and other supplied data remain in MDY even if absent from
the prose. External files and documents remain references only: the exporter
does not fetch, dereference, or embed their remote contents. Already-supplied
inline data, including signature images, is still retained in the structured
snapshot. Review the full MDY before sharing it; omitting a field from a template
does not remove its data.

### Output templates

Set top-level `outputTemplate` to a **string containing a Handlebars Markdown
body**, not an MDY document or YAML front matter. It composes answers independently
of the form layout. For example:

```yaml
outputTemplate: |
  # {{form.title}}

  {{fields.employee_name}} requests {{fields.accommodation}} beginning
  {{fields.start_date}} because {{fields.reason}}.

  {{#if fields.duration.answered}}
  Requested duration: {{fields.duration}}.
  {{/if}}
  {{#unless fields.reason.answered}}
  A reason has not been provided.
  {{/unless}}
```

Every referenced field must exist in the definition. The runnable demo definition
is [../../demo/src/schemas/response-export.yaml](../../demo/src/schemas/response-export.yaml).
It includes those fields, a date input, numeric duration with a unit, choice
labels, and a section nested inside another section.

The template context is deliberately limited:

- `{{fields.employee_name}}`: implicit MDY link,
  `[escaped display](#employee_name)`.
- `{{fields.employee_name.display}}`: plain escaped display text, without a link.
- `fields.employee_name.answered`: predicate for whether a display value was
  produced, not required-field validation.
- `{{form.title}}`: escaped form title, falling back to form ID when absent.
- `{{form.id}}`, `{{form.description}}`: escaped form metadata; an absent
  description is empty.
- `{{#if ...}}`, `{{#unless ...}}`: conditional blocks, including `{{else}}`.
- `{{#each fields}}...{{/each}}`: iterate all indexed fields, including containers
  and hidden fields, not raw answer data.

Inside `#each fields`, `{{this}}` produces an implicit field link;
`{{this.display}}`, `this.answered`, `{{@key}}`, `{{@index}}`, `{{@first}}`, and
`{{@last}}` are also permitted. For example, list only fields with a display value:

```text
{{#each fields}}
{{#if this.answered}}
- {{@key}}: {{this}}
{{/if}}
{{/each}}
```

There are no partials, decorators, `lookup`, arbitrary JavaScript, custom helpers,
parent paths, or access to raw response objects. Unknown field references and
unsupported properties (such as `fields.employee_name.answer`) are errors,
**even inside untaken branches**. Malformed templates and unresolved template
syntax in the result are errors too. Empty or whitespace-only templates are
errors, not requests for the default layout.

`options.template` overrides `form.outputTemplate` for that export without
changing the supplied form. If neither is defined, the exporter generates the
default layout. To request that layout for a form with a template, supply a copy
of the form with `outputTemplate` omitted; an empty override will fail.

All field-definition IDs, including section/container IDs, must match
`^[a-z0-9_-]+$`: lowercase ASCII letters, digits, underscores, and hyphens only.
The names `__proto__`, `constructor`, and `prototype` are reserved. Invalid IDs
and duplicate IDs anywhere in the field tree throw errors before rendering,
including for hidden or unreferenced fields. These are export restrictions; do
not assume every ID accepted by a form editor is exportable.

Explicit Markdown field links, such as `[Employee](#employee_name)` or
`[Employee](mdy:employee_name)`, must reference real fields in the supplied form.
This also applies to reference-style links and their referenced definitions.
Unknown or malformed fragment (`#...`) and `mdy:` destinations throw errors.
These are field references, not automatic heading-anchor links: a heading alone
does not make its fragment a valid destination. Link examples inside code fences
are not validated, and external links are allowed.

### Default layout and display limitations

Without a template, the body uses form/page/section headings and linked field
answers in definition order. Declarative visibility is evaluated with JavaScript
disabled; hidden fields are omitted from this body, not the MDY snapshot.
Templates instead choose their own content and can reference hidden fields.

- Text and long text display stored scalar answers. Numeric inputs use
  `Intl.NumberFormat`; valid `YYYY-MM-DD` dates use `Intl.DateTimeFormat` in UTC.
  Both honor `options.locale`. A text field's `unit` is appended. Other date/time
  variants are not specially formatted, and invalid dates remain stored text.
- Choices use definition option `text`, then `value`, with stored selection
  `value` as a fallback. Multiple selections are comma-separated. Multitext and
  matrix responses produce labeled entries; unknown choices can produce an
  `unknown-option` diagnostic and the `Unknown option` label.
- Absent/empty answers display **Not answered** by default. Override labels using
  `options.labels`, for example `{ notAnswered: 'Not provided' }`. An `answered`
  predicate tests display availability, not clinical meaning or completeness;
  rich-value placeholders also count as display values. Fully cleared matrices
  are unanswered (`answered: false`), display **Not answered**, and receive a
  `missing-answer` diagnostic in the default layout. Partially answered matrices
  remain answered and show **Not answered** for cleared or missing rows.
- Files display titles or **Attachment reference**. Signatures and diagrams use
  **Signature recorded** and **Diagram recorded** placeholders, not rendered
  drawings. Activity uses **Activity retained in structured data**.
- In the default layout, static display content is escaped text, with no
  expression interpolation. Rich static HTML becomes **Value retained in
  structured data**; images use a caption/alt/label rather than embedding media.
- Custom values have no custom renderer: recognized scalar/selection shapes use
  the generic formatting above; unsupported structured values use **Value
  retained in structured data** with an `unsupported-value` diagnostic. Their
  original data remains in MDY.

Diagnostic codes are `missing-answer`, `unknown-option`, `unsupported-value`,
`orphan-response`, and `javascript-disabled`. `missing-answer` is emitted for
unanswered fields included by the default layout, not for every omitted answer in
a template. `javascript-disabled` flags visible-rule handling when JavaScript is
enabled on the form; it is not a calculation audit. Export permits incomplete
responses and does not perform submission/completion validation.

### Markdown, MDY, and printable HTML API

This example uses a parsed, validated copy of the demo definition and a plain
response snapshot. Keep dates in the response as strings, not `Date` objects.

```typescript
import type { FormDefinition, FormResponse } from '@esheet/core';
import { exportResponse } from '@esheet/adapters';
import { renderResponseHtml } from '@esheet/adapters/html';

async function makeAccommodationDocument(form: FormDefinition) {
  const response: FormResponse = {
    employee_name: { answer: 'Jordan Rivera' },
    accommodation: {
      selected: { id: 'adjustable_desk', value: 'Adjustable desk' },
    },
    start_date: { answer: '2026-10-01' },
    reason: { answer: 'Alternate sitting and standing during desk work.' },
    duration: { answer: '6' },
    hours_per_day: { answer: '4.5' },
  };

  const { mdy, markdown, diagnostics } = await exportResponse(form, response, {
    locale: 'en-US',
    labels: { notAnswered: 'Not provided' },
    renderedAt: new Date('2026-10-01T12:00:00Z'),
    // Optional per-export override; otherwise use form.outputTemplate:
    // template: '# {{form.title}}\n\nRequested by {{fields.employee_name}}.',
  });
  const html = await renderResponseHtml(markdown, {
    title: form.title ?? form.id,
    language: 'en-US',
    direction: 'ltr', // or 'rtl'
  });
  return { mdy, markdown, html, diagnostics };
}
```

Supply detached **plain data snapshots**, not stores, functions, accessors, class
instances, cyclic objects, or non-finite numbers. `renderedAt` is a separate
option accepting a `Date`. Export does not execute calculations or embedded
JavaScript, even with `dangerouslyAllowJS: true`; it formats answers already
present in the snapshot. Any computation needed for the document must have
occurred before the snapshot was taken.

`renderResponseHtml(markdown, options?)` returns a standalone HTML document,
**not a fragment**, and must receive the Markdown body, not MDY. It explicitly
sanitizes the converted HTML using an allowlist; templit/marked conversion alone
does **not** sanitize. Display values and form labels are escaped so untrusted
values cannot introduce Markdown or HTML. Template-authored markup still needs
the HTML sanitizer. Scripts, images, remote assets, event handlers, and user
styles are not embedded. Links retain only allowed HTTP(S), mailto, or fragment
destinations and navigate on activation; field links are structured-data
references, not a promise of matching HTML scroll targets.

The HTML includes a restrictive Content Security Policy and self-contained,
scoped print CSS for headings, lists, tables, page breaks, and LTR/RTL text.
Hosts converting Markdown by another route must provide their own explicit HTML
sanitization before previewing or printing.

### Try the demo

In the demo renderer, select **Response Export - Accommodation Request**, enter
answers (for example, the values above), and choose **Preview document**. The
preview uses a detached snapshot without enforcing completion validation. It
shows sanitized printable HTML, export diagnostics, and expandable **Preview
Markdown (body only)** / **Preview MDY (full data)** sections. Actions include
**Download MDY (full data)**, **Download Markdown (body only)**, **Download HTML**,
and **Print document**. Printing is enabled after the preview frame loads. The
full-data warning applies to the MDY preview and download as well as the API.
