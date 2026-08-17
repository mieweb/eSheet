---
slug: /field-types/slider
---

# slider

Range slider selection field.

## Properties

- `options`: Array of `FieldOption` defining the range points

## Answer Format

```yaml
selected:
  id: optionId
  value: '50'
```

## Example

```yaml
id: satisfaction
fieldType: slider
question: Overall Satisfaction
options:
  - id: s0
    value: '0'
  - id: s50
    value: '50'
  - id: s100
    value: '100'
```
