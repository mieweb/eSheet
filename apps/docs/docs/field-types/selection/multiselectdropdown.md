---
slug: /field-types/multiselectdropdown
---

# multiselectdropdown

Multi-select dropdown field.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```json
{ "selected": [{ "id": "optionId", "value": "Option Label" }] }
```

## Example

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