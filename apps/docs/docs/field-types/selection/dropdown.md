---
slug: /field-types/dropdown
---

# dropdown

Single-select dropdown field.

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
id: department
fieldType: dropdown
question: Department
options:
  - id: d1
    value: Cardiology
  - id: d2
    value: Neurology
  - id: d3
    value: Orthopedics
```
