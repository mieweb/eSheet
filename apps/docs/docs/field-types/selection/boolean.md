---
slug: /field-types/boolean
---

# boolean

Binary Yes/No field.

## Properties

No explicit `options` needed. Built-in Yes and No options are used.

## Answer Format

```json
{ "selected": { "id": "yes-or-no", "value": "Yes" } }
```

## Example

```json
{
  "id": "allergies",
  "fieldType": "boolean",
  "question": "Do you have any known allergies?"
}
```