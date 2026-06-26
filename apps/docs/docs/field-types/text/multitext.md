---
slug: /field-types/multitext
---

# multitext

Multiple text inputs, one per option.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```json
{ "multitextAnswers": { "optionId": "string value" } }
```

## Example

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
