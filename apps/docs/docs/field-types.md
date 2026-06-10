---
sidebar_position: 6
---

# Field Types

eSheet includes 19 built-in field types organized into six categories. Each field type has specific properties, answer format, and visual behavior.

## Overview

| Category             | Field Types                                                    |
| -------------------- | -------------------------------------------------------------- |
| **Text**             | `text`, `longtext`, `multitext`                                |
| **Selection**        | `radio`, `check`, `boolean`, `dropdown`, `multiselectdropdown` |
| **Rating & Ranking** | `rating`, `ranking`, `slider`                                  |
| **Matrix**           | `singlematrix`, `multimatrix`                                  |
| **Organization**     | `section`                                                      |
| **Rich Media**       | `display`, `html`, `image`, `signature`, `diagram`             |

---

## Text Fields

### text

Single-line text input with 9 input type variants.

**Properties:**

- `inputType` -- Input variant (default: `'string'`)
- `unit` -- Unit suffix displayed after the input (e.g. "kg", "lbs")

**Input Types:** `string`, `number`, `email`, `tel`, `date`, `datetime-local`, `month`, `time`, `url`

**Answer format:** `{ answer: string }`

```json
{
  "id": "weight",
  "fieldType": "text",
  "question": "Patient Weight",
  "inputType": "number",
  "unit": "kg",
  "required": true
}
```

Special behaviors:

- `tel` -- Automatically formats US phone numbers as `(XXX) XXX-XXXX`
- `date`, `time`, `month`, `datetime-local` -- Renders native browser date/time pickers
- `email`, `url` -- Browser-level input validation

### longtext

Multi-line textarea for longer responses.

**Answer format:** `{ answer: string }`

```json
{
  "id": "notes",
  "fieldType": "longtext",
  "question": "Additional Notes"
}
```

### multitext

Multiple text inputs -- one per option. Useful when you need several labeled text responses under one question.

**Properties:**

- `options` -- Array of `FieldOption` (each becomes a text input with the option value as label)

**Answer format:** `{ multitextAnswers: Record<optionId, string> }`

```json
{
  "id": "vitals",
  "fieldType": "multitext",
  "question": "Record vitals",
  "options": [
    { "id": "bp", "value": "Blood Pressure" },
    { "id": "hr", "value": "Heart Rate" },
    { "id": "temp", "value": "Temperature" }
  ]
}
```

**Response example:**

```json
{
  "vitals": {
    "multitextAnswers": {
      "bp": "120/80",
      "hr": "72",
      "temp": "98.6"
    }
  }
}
```

---

## Selection Fields

### radio

Single-select radio buttons. Supports deselection (clicking the selected option again clears it).

**Properties:**

- `options` -- Array of `FieldOption` (each option may have an optional `score`)

**Answer format:** `{ selected: SelectedOption }` where `SelectedOption = { id, value }`

```json
{
  "id": "gender",
  "fieldType": "radio",
  "question": "Gender",
  "options": [
    { "id": "m", "value": "Male" },
    { "id": "f", "value": "Female" },
    { "id": "o", "value": "Other" }
  ]
}
```

With option scoring (e.g. a scored survey):

```json
{
  "id": "phq_interest",
  "fieldType": "radio",
  "question": "Little interest or pleasure in doing things?",
  "options": [
    { "id": "a0", "value": "Not at all", "score": 0 },
    { "id": "a1", "value": "Several days", "score": 1 },
    { "id": "a2", "value": "More than half the days", "score": 2 },
    { "id": "a3", "value": "Nearly every day", "score": 3 }
  ]
}
```

### check

Multi-select checkboxes. Users can select any combination of options.

**Properties:**

- `options` -- Array of `FieldOption` (each option may have an optional `score`; the field score is the sum of scores of all selected options)

**Answer format:** `{ selected: SelectedOption[] }`

```json
{
  "id": "symptoms",
  "fieldType": "check",
  "question": "Current Symptoms",
  "options": [
    { "id": "s1", "value": "Headache" },
    { "id": "s2", "value": "Nausea" },
    { "id": "s3", "value": "Fatigue" },
    { "id": "s4", "value": "Dizziness" }
  ]
}
```

### boolean

Binary Yes/No toggle. Displays two radio-style buttons.

**Answer format:** `{ selected: SelectedOption }` -- value is `"Yes"` or `"No"`

```json
{
  "id": "allergies",
  "fieldType": "boolean",
  "question": "Do you have any known allergies?"
}
```

:::info
Boolean fields don't need `options` -- the Yes/No options are built-in.
:::

### dropdown

Single-select dropdown menu.

**Properties:**

- `options` -- Array of `FieldOption` (each option may have an optional `score`)

**Answer format:** `{ selected: SelectedOption }`

```json
{
  "id": "department",
  "fieldType": "dropdown",
  "question": "Department",
  "options": [
    { "id": "d1", "value": "Cardiology" },
    { "id": "d2", "value": "Neurology" },
    { "id": "d3", "value": "Orthopedics" }
  ]
}
```

### multiselectdropdown

Multi-select dropdown with tag-style selected items.

**Properties:**

- `options` -- Array of `FieldOption` (each option may have an optional `score`; the field score is the sum of scores of all selected options)

**Answer format:** `{ selected: SelectedOption[] }`

```json
{
  "id": "medications",
  "fieldType": "multiselectdropdown",
  "question": "Current Medications",
  "options": [
    { "id": "m1", "value": "Aspirin" },
    { "id": "m2", "value": "Ibuprofen" },
    { "id": "m3", "value": "Metformin" },
    { "id": "m4", "value": "Lisinopril" }
  ]
}
```

---

## Rating & Ranking Fields

### rating

Numeric scale displayed as selectable pills (e.g. 1-5 or 1-10).

**Properties:**

- `options` -- Array of `FieldOption` representing scale values (each option may have an optional `score`; defaults to the option's numeric `value` if no `score` is set)

**Answer format:** `{ selected: SelectedOption }`

```json
{
  "id": "pain_level",
  "fieldType": "rating",
  "question": "Pain Level (1-10)",
  "options": [
    { "id": "r1", "value": "1" },
    { "id": "r2", "value": "2" },
    { "id": "r3", "value": "3" },
    { "id": "r4", "value": "4" },
    { "id": "r5", "value": "5" },
    { "id": "r6", "value": "6" },
    { "id": "r7", "value": "7" },
    { "id": "r8", "value": "8" },
    { "id": "r9", "value": "9" },
    { "id": "r10", "value": "10" }
  ]
}
```

### ranking

Drag-to-order items. Users arrange options in their preferred order.

**Properties:**

- `options` -- Array of `FieldOption`

**Answer format:** `{ selected: SelectedOption[] }` -- ordered by user's ranking (first = highest)

:::note
Ranking uses **position-based scoring** automatically: 1st place = k points, 2nd = k-1, ..., last = 1 (where k is the total number of options). Individual `score` values on options are not used for ranking fields.
:::

```json
{
  "id": "priorities",
  "fieldType": "ranking",
  "question": "Rank these health priorities (most important first)",
  "options": [
    { "id": "p1", "value": "Exercise" },
    { "id": "p2", "value": "Diet" },
    { "id": "p3", "value": "Sleep" },
    { "id": "p4", "value": "Stress Management" }
  ]
}
```

### slider

Range slider with numeric selection.

**Properties:**

- `options` -- Array of `FieldOption` defining the range (first = min, last = max; each option may have an optional `score` to override the default numeric `value`)

**Answer format:** `{ selected: SelectedOption }`

```json
{
  "id": "satisfaction",
  "fieldType": "slider",
  "question": "Overall Satisfaction",
  "options": [
    { "id": "s0", "value": "0" },
    { "id": "s25", "value": "25" },
    { "id": "s50", "value": "50" },
    { "id": "s75", "value": "75" },
    { "id": "s100", "value": "100" }
  ]
}
```

---

## Matrix Fields

### singlematrix

Grid where each row allows exactly one column selection (radio-per-row).

**Properties:**

- `rows` -- Array of `MatrixRow`
- `columns` -- Array of `MatrixColumn` (each column may have an optional `score`)
- `scored` -- _(optional)_ Enable auto-scoring: columns are assigned scores `0, 1, 2, ...` left to right. Individual `column.score` values override the auto-assigned score.
- `scoreStart` -- _(optional)_ Starting value for auto-scoring when `scored: true` (default: `0`)

**Answer format:** `{ selected: Record<rowId, SelectedOption> }`

```json
{
  "id": "symptom_severity",
  "fieldType": "singlematrix",
  "question": "Rate each symptom's severity",
  "scored": true,
  "scoreStart": 0,
  "rows": [
    { "id": "r_head", "value": "Headache" },
    { "id": "r_back", "value": "Back Pain" },
    { "id": "r_joint", "value": "Joint Pain" }
  ],
  "columns": [
    { "id": "c_none", "value": "None" },
    { "id": "c_mild", "value": "Mild" },
    { "id": "c_mod", "value": "Moderate" },
    { "id": "c_sev", "value": "Severe" }
  ]
}
```

**Response example:**

```json
{
  "symptom_severity": {
    "selected": {
      "r_head": { "id": "c_mild", "value": "Mild" },
      "r_back": { "id": "c_sev", "value": "Severe" },
      "r_joint": { "id": "c_none", "value": "None" }
    }
  }
}
```

### multimatrix

Grid where each row allows multiple column selections (checkboxes-per-row).

**Properties:**

- `rows` -- Array of `MatrixRow`
- `columns` -- Array of `MatrixColumn` (each column may have an optional `score`)
- `scored` -- _(optional)_ Enable auto-scoring: columns are assigned scores `0, 1, 2, ...` left to right. Individual `column.score` values override the auto-assigned score.
- `scoreStart` -- _(optional)_ Starting value for auto-scoring when `scored: true` (default: `0`)

**Answer format:** `{ selected: Record<rowId, SelectedOption[]> }`

```json
{
  "id": "symptoms_time",
  "fieldType": "multimatrix",
  "question": "When do you experience these symptoms?",
  "rows": [
    { "id": "r_head", "value": "Headache" },
    { "id": "r_fatigue", "value": "Fatigue" }
  ],
  "columns": [
    { "id": "c_morn", "value": "Morning" },
    { "id": "c_aft", "value": "Afternoon" },
    { "id": "c_eve", "value": "Evening" },
    { "id": "c_night", "value": "Night" }
  ]
}
```

---

## Organization

### section

Container field that groups other fields. Sections can be nested recursively.

**Properties:**

- `title` -- Section heading
- `fields` -- Array of nested `FieldDefinition` (recursive)

**Answer format:** None (container only -- children hold their own answers)

```json
{
  "id": "personal_info",
  "fieldType": "section",
  "title": "Personal Information",
  "fields": [
    {
      "id": "first_name",
      "fieldType": "text",
      "question": "First Name",
      "inputType": "string"
    },
    {
      "id": "last_name",
      "fieldType": "text",
      "question": "Last Name",
      "inputType": "string"
    }
  ]
}
```

:::tip
Sections are useful for grouping related fields visually and for applying conditional visibility to an entire group at once.
:::

---

## Rich Media / Presentational Fields

### display

Markdown-like content field with expression interpolation. Great for calculated summaries, instructions, or dynamic messages that reference other field values.

**Properties:**

- `content` -- Markdown string with inline expressions

**Markdown syntax:**

- `*bold*` -- **bold**
- `-italic-` -- _italic_
- `_underline_` -- underline
- `~strikethrough~` -- ~~strikethrough~~
- `- item` -- bullet list
- `# Heading` -- heading

**Expression interpolation:**

- `{fieldId}` -- Inserts the field's current answer value
- `<{fieldA} + {fieldB}>` -- Evaluates an arithmetic expression and inserts the result

**Answer format:** None (display only)

```json
{
  "id": "bmi_result",
  "fieldType": "display",
  "content": "# BMI Calculator\n\nYour weight: *{weight}* kg\nYour height: *{height}* cm\n\nYour BMI is: *<{weight} / (({height}/100) * ({height}/100))>*"
}
```

### html

Raw HTML embed. Renders the provided HTML content directly.

**Properties:**

- `htmlContent` -- Raw HTML string

**Answer format:** None (display only)

```json
{
  "id": "notice",
  "fieldType": "html",
  "htmlContent": "<div style='padding:16px;background:#fef3c7;border-radius:8px'><strong>Notice:</strong> This form is for informational purposes only.</div>"
}
```

### image

Displays an image with optional alt text and caption.

**Properties:**

- `imageUri` -- Image URL
- `altText` -- Accessible alt text
- `caption` -- Caption below the image

**Answer format:** None (display only)

```json
{
  "id": "anatomy_ref",
  "fieldType": "image",
  "imageUri": "https://example.com/anatomy-diagram.png",
  "altText": "Human anatomy reference diagram",
  "caption": "Reference: Anatomy chart for pain location"
}
```

### signature

Drawing pad for capturing signatures. Stores both the stroke data (for re-rendering) and a base64 PNG image.

**Properties:**

- `padPlaceholder` -- Placeholder text on the canvas (e.g. "Sign here")

**Answer format:**

```typescript
{
  signatureData?: string;  // JSON stroke data (normalized coordinates)
  signatureImage?: string; // base64 PNG export
}
```

**Drawing pad features:**

- Pen and eraser tools
- Undo/redo support
- Responsive (maintains aspect ratio across viewports)
- Strokes are normalized (0..1 coordinates) for lossless scaling

```json
{
  "id": "patient_sig",
  "fieldType": "signature",
  "question": "Patient Signature",
  "padPlaceholder": "Sign here",
  "required": true
}
```

### diagram

Drawing pad for markup and annotations. Identical to signature but uses separate response properties.

**Properties:**

- `padPlaceholder` -- Placeholder text on the canvas

**Answer format:**

```typescript
{
  markupData?: string;  // JSON stroke data
  markupImage?: string; // base64 PNG export
}
```

```json
{
  "id": "pain_diagram",
  "fieldType": "diagram",
  "question": "Mark the areas where you feel pain",
  "padPlaceholder": "Draw on the diagram"
}
```
