---
slug: /field-types/signature
---

# signature

Signature capture pad.

## Properties

- `padPlaceholder`: Placeholder text for the drawing area

## Answer Format

```json
{
  "signatureData": "serialized-strokes",
  "signatureImage": "base64-png"
}
```

## Example

```json
{
  "id": "patient_sig",
  "fieldType": "signature",
  "question": "Patient Signature",
  "padPlaceholder": "Sign here",
  "required": true
}
```