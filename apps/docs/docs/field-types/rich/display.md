---
slug: /field-types/display
---

# display

Presentational content field with inline expression interpolation.

## Properties

- `content`: Markdown-like content with optional placeholders

## Answer Format

Display-only field. No answer payload.

## Example

```json
{
  "id": "bmi_result",
  "fieldType": "display",
  "content": "Your BMI is <{weight} / (({height}/100) * ({height}/100))>"
}
```