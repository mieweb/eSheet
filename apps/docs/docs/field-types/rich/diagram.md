---
slug: /field-types/diagram
---

# diagram

Markup and annotation drawing pad.

## Properties

- `padPlaceholder`: Placeholder text for the drawing area

## Answer Format

```json
{
  "markupData": "serialized-strokes",
  "markupImage": "base64-png"
}
```

## Example

```json
{
  "id": "pain_diagram",
  "fieldType": "diagram",
  "question": "Mark the areas where you feel pain",
  "padPlaceholder": "Draw on the diagram"
}
```
