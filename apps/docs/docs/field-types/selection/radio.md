---
slug: /field-types/radio
---

# radio

Single-select radio field.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```yaml
selected:
  id: optionId
  value: Option Label
```

## Example

```yaml
id: gender
fieldType: radio
question: Gender
options:
  - id: m
    value: Male
  - id: f
    value: Female
  - id: o
    value: Other
```
