---
slug: /field-types/custom/kerebron
---

# kerebron

The `@esheet/field-kerebron` package adds a `richtext` field type backed by the
[Kerebron](https://kerebron.dev/) ProseMirror-based editor. It is an optional
package and belongs under custom field types because it is not part of the
base built-in field set.

---

## Installation

```bash
npm install @esheet/field-kerebron
```

This package must be used alongside `@esheet/builder` or `@esheet/renderer`.

---

## Setup

### 1. Configure the asset loader

The Kerebron editor requires WASM binaries. Call `configureRichTextField` once
at application startup, before mounting any component that renders a `richtext`
field:

```ts
import { configureRichTextField } from '@esheet/field-kerebron';
import { createAssetLoad } from '@kerebron/wasm/web';

configureRichTextField({
  assetLoad: createAssetLoad('/kerebron-wasm'),
});
```

The path (`'/kerebron-wasm'`) must point to the directory where the
`@kerebron/wasm/assets` files are served. Configure your build tool to serve
these files directly during development and emit them at that path for
production; a checked-in public copy is not required.

### 2. Register the field component

After configuring the asset loader, register the component so eSheet knows how
to render `richtext` fields:

```ts
import { registerFieldComponents } from '@esheet/fields';
import { RichTextEditorField } from '@esheet/field-kerebron';

registerFieldComponents({ richtext: RichTextEditorField });
```

Call this once before your app mounts `EsheetBuilder` or `EsheetRenderer`.

---

## Schema

Use `fieldType: 'richtext'` in your `FormDefinition`. The optional
`defaultContent` property pre-populates the editor with initial rich text:

```yaml
id: notes
fieldType: richtext
question: Clinical Notes
required: false
defaultContent: <p>Enter your notes here.</p>
```

### Field definition properties

| Property         | Type      | Description                                                               |
| ---------------- | --------- | ------------------------------------------------------------------------- |
| `fieldType`      | `string`  | Must be `'richtext'`                                                      |
| `id`             | `string`  | Unique field identifier                                                   |
| `question`       | `string`  | Label shown above the editor                                              |
| `required`       | `boolean` | Whether the field must have content before submitting                     |
| `defaultContent` | `string`  | Optional HTML string used to pre-fill the editor before a response exists |

---

## Response format

Rich text answers are stored as a raw HTML string in `response.answer`:

```yaml
notes:
  answer: <p>Patient reports mild discomfort.</p>
```

---

## Builder behavior

When `@esheet/field-kerebron` is installed and registered:

- The builder ToolPanel shows a **Rich Text Editor** entry in the **Rich** category.
- Selecting a `richtext` field in the canvas opens its edit panel where you can
  set the question, required flag, and default content.
- Preview mode renders a live Kerebron editor.

---

## Complete example

```tsx
import { configureRichTextField } from '@esheet/field-kerebron';
import { createAssetLoad } from '@kerebron/wasm/web';
import { registerFieldComponents } from '@esheet/fields';
import { RichTextEditorField } from '@esheet/field-kerebron';
import { EsheetRenderer } from '@esheet/renderer';

configureRichTextField({
  assetLoad: createAssetLoad('/kerebron-wasm'),
});

registerFieldComponents({ richtext: RichTextEditorField });

const form = `
id: intake-form
title: Patient Intake
pages:
  - id: patient-information
    fields:
      - id: name
        fieldType: text
        question: Full Name
        required: true
      - id: notes
        fieldType: richtext
        question: Additional Notes
`;

export function IntakePage() {
  return <EsheetRenderer formDataInput={form} />;
}
```

---

## Notes

- `configureRichTextField` must be called before any component renders a `richtext` field.
- If `configureRichTextField` is not called, `richtext` fields render without editor content and log a warning.
- `richtext` is not part of the base 19 built-in field types. It is registered dynamically by importing `@esheet/field-kerebron`.
