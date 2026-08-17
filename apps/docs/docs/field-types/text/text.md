---
slug: /field-types/text
---

# text

Single-line text input.

## Properties

- `inputType`: Input variant (default `string`)
- `unit`: Unit suffix shown after the input

Supported `inputType` values: `string`, `number`, `email`, `tel`, `date`, `datetime-local`, `month`, `time`, `url`.

## Answer Format

```yaml
answer: string value
```

## Example

```yaml
id: weight
fieldType: text
question: Patient Weight
inputType: number
unit: kg
required: true
```
