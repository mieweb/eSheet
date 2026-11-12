---
slug: /field-types/ranking
---

# ranking

Drag-to-order ranking field.

## Properties

- `options`: Array of `FieldOption`

## Answer Format

```yaml
selected:
  - id: optionId
    value: Option Label
```

Selected options are ordered from highest to lowest rank.

## Example

```yaml
id: priorities
fieldType: ranking
question: Rank these priorities
options:
  - id: p1
    value: Exercise
  - id: p2
    value: Diet
  - id: p3
    value: Sleep
```
