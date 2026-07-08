---
sidebar_position: 2
---

# FHIR Extensions

eSheet defines two custom FHIR extensions to preserve its layout model when exporting to FHIR Questionnaire resources. Both extensions use `valueCode` and round-trip cleanly through import/export.

Extension URL constants are exported from `@esheet/adapters` as `FHIR_EXT.FIELD_WIDTH` and `FHIR_EXT.OPTION_LAYOUT`.

---

## `field-width`

**URL:** `https://esheet.os.mieweb.org/docs/adapters/fhir/extensions#field-width`

Controls the column width a questionnaire item occupies in a row-based layout grid. Corresponds to the `width` property on [`FieldWidth`](/docs/schema-format#fieldwidth) in the eSheet schema.

### Value set

| `valueCode` | Description                             |
| ----------- | --------------------------------------- |
| `full`      | Spans the full row width (default)      |
| `half`      | Takes up half the row (2 per row)       |
| `third`     | Takes up a third of the row (3 per row) |

When absent the field renders at `full` width.

### Example

```json
{
  "linkId": "first-name",
  "text": "First Name",
  "type": "string",
  "extension": [
    {
      "url": "https://esheet.os.mieweb.org/docs/adapters/fhir/extensions#field-width",
      "valueCode": "half"
    }
  ]
}
```

### Applies to

All answer-bearing item types (`string`, `text`, `boolean`, `decimal`, `integer`, `date`, `dateTime`, `time`, `url`, `choice`, `open-choice`, `attachment`).

---

## `option-layout`

**URL:** `https://esheet.os.mieweb.org/docs/adapters/fhir/extensions#option-layout`

Controls how the answer options of a choice item are rendered. Corresponds to the `optionLayout` property on [`OptionLayout`](/docs/schema-format#optionlayout) in the eSheet schema.

### Value set

| `valueCode` | Description                                         |
| ----------- | --------------------------------------------------- |
| `stack`     | One option per line, stacked vertically (default)   |
| `wrap`      | Options flow horizontally and wrap to the next line |

When absent the options render in `stack` layout.

### Example

```json
{
  "linkId": "preferred-contact",
  "text": "Preferred contact method",
  "type": "choice",
  "extension": [
    {
      "url": "https://esheet.os.mieweb.org/docs/adapters/fhir/extensions#option-layout",
      "valueCode": "wrap"
    }
  ],
  "answerOption": [
    { "valueCoding": { "code": "phone", "display": "Phone" } },
    { "valueCoding": { "code": "email", "display": "Email" } },
    { "valueCoding": { "code": "sms", "display": "SMS" } }
  ]
}
```

### Applies to

`choice` and `open-choice` items that map to `radio`, `check`, or `multitext` field types.

---

## Using with the adapter

Both extensions are written automatically by `exportToFhir` when the field definition includes `width` or `optionLayout`, and are read back by `importFromFhir` to restore those properties.

```typescript
import { exportToFhir, FHIR_EXT } from '@esheet/adapters';

const form = {
  id: 'contact-form',
  fields: [
    {
      id: 'first-name',
      fieldType: 'text',
      question: 'First Name',
      width: 'half',
    },
    {
      id: 'preferred-contact',
      fieldType: 'radio',
      question: 'Preferred contact method',
      optionLayout: 'wrap',
      options: [
        { id: 'phone', value: 'Phone' },
        { id: 'email', value: 'Email' },
        { id: 'sms', value: 'SMS' },
      ],
    },
  ],
};

const questionnaire = exportToFhir(form);
// Each item's extension array will include FHIR_EXT.FIELD_WIDTH / FHIR_EXT.OPTION_LAYOUT
```

You can reference the extension URL constants directly:

```typescript
console.log(FHIR_EXT.FIELD_WIDTH);
// 'https://esheet.os.mieweb.org/docs/adapters/fhir/extensions#field-width'

console.log(FHIR_EXT.OPTION_LAYOUT);
// 'https://esheet.os.mieweb.org/docs/adapters/fhir/extensions#option-layout'
```
