# @esheet/pdf

Generate fillable AcroForm PDFs from eSheet `FormDefinition` objects.

```ts
import { generatePdf } from '@esheet/pdf';

const result = await generatePdf(definition, {
  pageSize: 'letter',
  responses,
});

const blob = new Blob([result.bytes], { type: 'application/pdf' });
```

`generatePdf` returns the PDF bytes, page count, conversion warnings, and a
deterministic mapping between eSheet field IDs and PDF field names. The mapping
is intended to support future import and round-trip filling of external PDF
templates.

## Initial field support

- `text` and `longtext` become AcroForm text fields.
- `boolean` becomes an AcroForm checkbox.
- `radio`, `rating`, and `slider` become AcroForm radio groups.
- `check` and `multiselectdropdown` become checkbox groups.
- `dropdown` becomes an AcroForm dropdown.
- `multitext` becomes one text field per option.
- `display`, `section`, and `pages` become static PDF content.
- Other rich and custom fields are rendered with a static fallback and produce
  a warning.

The initial generator uses standard PDF fonts. Unsupported characters are
replaced and reported through `warnings`; custom embedded fonts are planned for
a later iteration.

## Editing field layout

`applyPdfFieldLayout` writes viewer edits back into the PDF. It can move and
resize generated AcroForm widgets and create additional text or checkbox
fields without rebuilding the page content.

```ts
import { applyPdfFieldLayout } from '@esheet/pdf';

const editedBytes = await applyPdfFieldLayout(result.bytes, editedMappings, {
  addedFields,
});
```
