---
sidebar_position: 4
---

# Code View

The Code View mode provides a full-featured YAML/JSON text editor powered by Monaco (the same editor used in VS Code). It opens in **YAML by default** because YAML is eSheet's canonical format for committed form layouts; switch to JSON when you need a wire/API representation.

## Accessing Code View

Click the **Code** tab in the builder header to switch to Code View. The entire form definition is displayed as editable text.

## Features

- **Syntax highlighting** for YAML and JSON
- **Schema validation** -- Monaco validates against the `FormDefinition` JSON schema (auto-generated from Zod schemas in `@esheet/core`)
- **Auto-completion** -- IntelliSense suggestions for field types, properties, and schema structure
- **Error indicators** -- Red squiggly underlines for invalid YAML/JSON or schema violations
- **Full-text editing** -- Add, modify, or delete fields directly in YAML or JSON

## Importing Form Definitions

You can paste a complete YAML or JSON form definition into Code View. The editor starts in YAML:

1. Switch to **Code** mode
2. Select all text (Ctrl+A)
3. Paste your YAML (or JSON) (Ctrl+V)
4. The form updates automatically when you switch back to **Build** or **Preview** mode

### YAML Format (default)

```yaml
id: my-form
title: My Form
pages:
  - id: page-1
    fields:
      - id: q1
        fieldType: text
        question: What is your name?
        inputType: string
```

### JSON Format

Use the **JSON** toggle when you need to exchange the definition with an API or another machine:

```json
{
  "id": "my-form",
  "title": "My Form",
  "pages": [
    {
      "id": "page-1",
      "fields": [
        {
          "id": "q1",
          "fieldType": "text",
          "question": "What is your name?",
          "inputType": "string"
        }
      ]
    }
  ]
}
```

## Error Handling

If the YAML or JSON is invalid (syntax error or schema violation):

- The builder shows an **error indicator** in the header
- Switching to Build or Preview mode is prevented until the error is fixed
- The `codeEditorHasError` flag is set in the UIStore

## Switching Between Modes

When switching **from Code View** to Build/Preview:

- The active format is parsed and the FormStore is updated with the new definition
- If parsing fails, you'll see an error and remain in Code View

When switching **to Code View** from Build/Preview:

- The current FormStore state is serialized to YAML and loaded into the editor
