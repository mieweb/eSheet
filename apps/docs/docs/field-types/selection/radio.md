---
slug: /field-types/radio
---

# radio

Single-select radio field.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```json
{ "selected": { "id": "optionId", "value": "Option Label" } }
```

## Example

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
