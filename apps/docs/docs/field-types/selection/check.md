---
slug: /field-types/check
---

# check

Multi-select checkbox field.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```json
{ "selected": [{ "id": "optionId", "value": "Option Label" }] }
```

## Example

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