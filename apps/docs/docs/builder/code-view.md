---
sidebar_position: 4
---

# Code View

The Code View mode provides a full-featured JSON/YAML text editor powered by Monaco (the same editor used in VS Code).

## Accessing Code View

Click the **Code** tab in the builder header to switch to Code View. The entire form definition is displayed as editable text.\n\n## Features\n\n- **Syntax highlighting** for JSON
- **Schema validation** -- Monaco validates against the `FormDefinition` JSON schema (auto-generated from Zod schemas in `@esheet/core`)
- **Auto-completion** -- IntelliSense suggestions for field types, properties, and schema structure
- **Error indicators** -- Red squiggly underlines for invalid JSON or schema violations
- **Full-text editing** -- Add, modify, or delete fields directly in JSON

## Importing Form Definitions

You can paste a complete JSON form definition into Code View:

1. Switch to **Code** mode
2. Select all text (Ctrl+A)
3. Paste your JSON (Ctrl+V)
4. The form updates automatically when you switch back to **Build** or **Preview** mode

### JSON Format

```json
{
  "schemaType": "mieforms-v1.0",
  "title": "My Form",
  "fields": [
    {
      "id": "q1",
      "fieldType": "text",
      "question": "What is your name?",
      "inputType": "string"
    }
  ]
}
```

## Error Handling

If the JSON is invalid (syntax error or schema violation):

- The builder shows an **error indicator** in the header
- Switching to Build or Preview mode is prevented until the error is fixed
- The `codeEditorHasError` flag is set in the UIStore

## Switching Between Modes

When switching **from Code View** to Build/Preview:
- The JSON is parsed and the FormStore is updated with the new definition
- If parsing fails, you'll see an error and remain in Code View

When switching **to Code View** from Build/Preview:
- The current FormStore state is serialized to JSON and loaded into the editor
