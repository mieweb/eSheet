---
slug: /field-types/rating
---

# rating

Numeric scale field rendered as selectable options.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```yaml
selected:
  id: optionId
  value: '1'
```

## Example

```yaml
id: pain_level
fieldType: rating
question: Pain Level (1-10)
options:
  - id: r1
    value: '1'
  - id: r2
    value: '2'
  - id: r3
    value: '3'
```
