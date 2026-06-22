---
slug: /field-types/section
---

# section

Container field that groups child fields.

## Properties

- `title`: Section heading
- `fields`: Array of nested `FieldDefinition`

## Answer Format

Section itself stores no direct answer. Child fields store answers.

## Example

```json
{
  "id": "personal_info",
  "fieldType": "section",
  "title": "Personal Information",
  "fields": [
    {
      "id": "first_name",
      "fieldType": "text",
      "question": "First Name"
    }
  ]
}
```