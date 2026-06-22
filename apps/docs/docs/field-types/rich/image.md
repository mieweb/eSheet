---
slug: /field-types/image
---

# image

Image display field.

## Properties

- `imageUri`: Image URL
- `altText`: Accessible alt text
- `caption`: Optional caption

## Answer Format

Display-only field. No answer payload.

## Example

```json
{
  "id": "anatomy_ref",
  "fieldType": "image",
  "imageUri": "https://example.com/anatomy-diagram.png",
  "altText": "Human anatomy diagram",
  "caption": "Reference image"
}
```