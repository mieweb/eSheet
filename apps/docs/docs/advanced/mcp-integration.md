---
sidebar_position: 4
---

# MCP / AI Tool Integration

eSheet provides Model Context Protocol (MCP) compatible tool definitions and hooks for integrating AI assistants with the builder and renderer.

## Overview

The MCP integration allows AI assistants to:

- **Builder:** Add fields, modify properties, reorder elements, manage options/rows/columns, add logic rules, fill preview responses
- **Renderer:** Fill field responses, get form state, validate submissions, clear responses

## Builder Integration

### Exports

```typescript
import {
  // MCP tool execution
  executeToolCall,
  // Tool definitions array (25 tools)
  BUILDER_TOOL_DEFINITIONS,
  // System prompt constant
  BUILDER_SYSTEM_PROMPT,
  // React hook for handling AI tool calls
  useBuilderMcpToolHandler,
  // Types
  type ToolDefinition,
  type UseBuilderMcpToolHandlerOptions,
} from '@esheet/builder';
```

### Using `onBuilderToolsReady`

The `useBuilderMcpToolHandler` hook returns a callback for the builder's `onBuilderToolsReady` prop. It listens for custom events on a target element and routes them to the appropriate MCP tool.

```tsx
import { EsheetBuilder, useBuilderMcpToolHandler } from '@esheet/builder';

function App() {
  const onBuilderToolsReady = useBuilderMcpToolHandler({
    eventName: 'ozwell-tool-call',
    target: document, // Optional, defaults to document
  });

  return <EsheetBuilder onBuilderToolsReady={onBuilderToolsReady} />;
}
```

#### Options

```typescript
interface UseBuilderMcpToolHandlerOptions {
  /** The DOM element to listen on for tool-call events. Defaults to document. */
  target?: EventTarget;
  /** The event name to listen for, e.g. 'ozwell-tool-call'. */
  eventName: string;
}
```

### Available Builder Tools

The `BUILDER_TOOL_DEFINITIONS` array contains 25 tools for form building operations:

#### Form Overview Tools

| Tool               | Description                                                                                                                                                                             | Parameters                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `get_form_summary` | **CALL FIRST.** Returns `{formId, fieldCount, fields}` with condensed field info (id, fieldType, question, required, optionCount, rowCount, columnCount, editWith, hasRules, hasValue). | None                                         |
| `get_field`        | Get full details of one field including options/rows/columns with IDs.                                                                                                                  | `fieldQuestion?: string`, `fieldId?: string` |
| `get_definition`   | Export complete form as JSON definition tree with all fields, options, rows, columns, and logic rules.                                                                                  | None                                         |
| `get_field_types`  | List all available field types with key, label, category, and capabilities.                                                                                                             | None                                         |
| `get_field_spec`   | Get full spec for a specific field type: capabilities, defaults, placeholder hints.                                                                                                     | `fieldType: string` (required)               |

#### Field CRUD Tools

| Tool           | Description                                                                                  | Parameters                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_field` | Add one field. Supports all field types including sections with parentId.                    | `fieldType: string`, `question: string`, `required?: boolean`, `options?: {value}[]`, `afterFieldId?: string`, `parentId?: string`, `properties?: object` |
| `update_field` | Change scalar field properties (question, required, inputType, min, max, step, placeholder). | `fieldQuestion?: string`, `fieldId?: string`, `updates: object`                                                                                           |
| `delete_field` | Delete a field by question or ID.                                                            | `fieldQuestion?: string`, `fieldId?: string`                                                                                                              |
| `move_field`   | Reorder a field to a new index position (0-based).                                           | `fieldQuestion?: string`, `fieldId?: string`, `toIndex: number`, `toParentId?: string`                                                                    |
| `reset_form`   | Clear all fields.                                                                            | None                                                                                                                                                      |

#### Option Management Tools

For radio, check, dropdown, rating, ranking, slider, multitext fields. **NOT for matrix fields.**

| Tool            | Description                              | Parameters                                                                                                  |
| --------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `add_option`    | Add an option.                           | `fieldQuestion?: string`, `fieldId?: string`, `value?: string`                                              |
| `update_option` | Update the label of an existing option.  | `fieldQuestion?: string`, `fieldId?: string`, `optionId?: string`, `currentValue?: string`, `value: string` |
| `remove_option` | Remove an option by ID or current label. | `fieldQuestion?: string`, `fieldId?: string`, `optionId?: string`, `currentValue?: string`                  |

#### Matrix Row/Column Tools

For singlematrix and multimatrix fields only.

| Tool            | Description                     | Parameters                                                                                                  |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `add_row`       | Add a row to a matrix field.    | `fieldQuestion?: string`, `fieldId?: string`, `value?: string`                                              |
| `update_row`    | Update a matrix row label.      | `fieldQuestion?: string`, `fieldId?: string`, `rowId?: string`, `currentValue?: string`, `value: string`    |
| `remove_row`    | Remove a matrix row by ID.      | `fieldQuestion?: string`, `fieldId?: string`, `rowId: string`                                               |
| `add_column`    | Add a column to a matrix field. | `fieldQuestion?: string`, `fieldId?: string`, `value?: string`                                              |
| `update_column` | Update a matrix column label.   | `fieldQuestion?: string`, `fieldId?: string`, `columnId?: string`, `currentValue?: string`, `value: string` |
| `remove_column` | Remove a matrix column by ID.   | `fieldQuestion?: string`, `fieldId?: string`, `columnId: string`                                            |

#### Response/Preview Tools

| Tool              | Description                                                                            | Parameters                                                 |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `fill_field`      | Set a preview response for ONE field. Returns `{result, filledCount, unfilledFields}`. | `fieldQuestion?: string`, `fieldId?: string`, `value: any` |
| `get_responses`   | Get current response values.                                                           | None                                                       |
| `clear_responses` | Clear all responses.                                                                   | None                                                       |

#### Form Metadata Tools

| Tool          | Description                   | Parameters   |
| ------------- | ----------------------------- | ------------ |
| `set_form_id` | Update the top-level form ID. | `id: string` |

#### Conditional Logic Tools

| Tool                  | Description                                                                                 | Parameters                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_field_rule`      | Add a conditional logic rule based on another field's response.                             | `fieldQuestion?: string`, `fieldId?: string`, `effect: 'visible'\|'enable'\|'required'`, `logic: 'AND'\|'OR'`, `conditions: {targetId, operator, expected}[]` |
| `add_expression_rule` | Add a conditional rule using a custom expression. Field IDs must be wrapped in `{fieldId}`. | `fieldQuestion?: string`, `fieldId?: string`, `effect: 'visible'\|'enable'\|'required'`, `expression: string`                                                 |
| `remove_rule`         | Remove a conditional logic rule by 0-based index.                                           | `fieldQuestion?: string`, `fieldId?: string`, `ruleIndex: number`                                                                                             |

### Supported Field Types

`text`, `longtext`, `multitext`, `radio`, `check`, `boolean`, `dropdown`, `multiselectdropdown`, `rating`, `ranking`, `slider`, `singlematrix`, `multimatrix`, `image`, `html`, `signature`, `diagram`, `display`, `section`

### Hook: useBuilderMcpToolHandler

```typescript
function useBuilderMcpToolHandler(
  options: UseBuilderMcpToolHandlerOptions
): (tools: BuilderTools) => void;
```

The hook returns a function that accepts `BuilderTools` (provided by the builder via `onBuilderToolsReady`). When an event matching `eventName` is dispatched, the hook extracts the tool name and arguments from the event detail and calls `executeToolCall`.

---

## Renderer Integration

### Exports

```typescript
import {
  // MCP tool execution
  executeToolCall,
  // Tool definitions array (7 tools)
  RENDERER_TOOL_DEFINITIONS,
  // System prompt constant
  RENDERER_SYSTEM_PROMPT,
  // React hook for handling AI tool calls
  useRendererMcpToolHandler,
  // Types
  type ToolDefinition,
  type UseRendererMcpToolHandlerOptions,
  type RendererTools,
} from '@esheet/renderer';
```

### Using `onRendererToolsReady`

```tsx
import { EsheetRenderer, useRendererMcpToolHandler } from '@esheet/renderer';

function App() {
  const onRendererToolsReady = useRendererMcpToolHandler({
    eventName: 'ozwell-tool-call',
  });

  return (
    <EsheetRenderer
      definition={definition}
      onRendererToolsReady={onRendererToolsReady}
    />
  );
}
```

### Available Renderer Tools

The `RENDERER_TOOL_DEFINITIONS` array contains 7 tools for form filling operations:

| Tool                 | Description                                                                                                                           | Parameters                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `get_form`           | Returns visible fields split into filled vs unfilled. Response: `{formId, totalFields, filledCount, unfilledFields, filledFieldIds}`. | None                                                       |
| `get_form_raw`       | Returns ALL fields regardless of visibility, conditional rules, or enabled state.                                                     | None                                                       |
| `get_responses`      | Get current raw response values for all fields.                                                                                       | None                                                       |
| `get_valid_response` | Run form validation. Returns full response if valid, or null plus field-level errors if validation fails.                             | None                                                       |
| `fill_field`         | Set a response value for ONE visible field. Returns `{result, filledCount, unfilledFields}`.                                          | `fieldId?: string`, `fieldQuestion?: string`, `value: any` |
| `clear_responses`    | Clear all current form responses.                                                                                                     | None                                                       |
| `get_form_tree`      | Get full rendered field tree including visibility, enabled, and required state.                                                       | None                                                       |

---

## Fill Field Format Rules

Both Builder and Renderer MCP tools enforce these value formats for `fill_field`:

| Field Type                                             | Value Format                                | Example                             |
| ------------------------------------------------------ | ------------------------------------------- | ----------------------------------- |
| `radio` / `dropdown` / `boolean` / `rating` / `slider` | Single string matching an option value      | `"Yes"`, `"Option A"`               |
| `check` / `multiselectdropdown`                        | Array of strings matching option values     | `["Option A", "Option B"]`          |
| `ranking`                                              | Ordered array of option value strings       | `["First", "Second", "Third"]`      |
| `multitext`                                            | Array of strings, one per option slot       | `["John", "Doe"]`                   |
| `singlematrix`                                         | Object: `{ "Row Label": "Column Label" }`   | `{"Satisfaction": "Very Good"}`     |
| `multimatrix`                                          | Object: `{ "Row Label": ["Col1", "Col2"] }` | `{"Features": ["Speed", "Design"]}` |
| `text` (date)                                          | `YYYY-MM-DD`                                | `"2026-05-21"`                      |
| `text` (datetime-local)                                | `YYYY-MM-DDTHH:mm`                          | `"2026-05-21T14:30"`                |
| `text` (month)                                         | `YYYY-MM`                                   | `"2026-05"`                         |
| `text` (time)                                          | `HH:mm` (24-hour)                           | `"14:30"`                           |

:::warning
Wrong formats are rejected with an error. Always use the `valueFormat` property from the field schema.
:::

---

## Expression Rule Syntax

The `add_expression_rule` tool accepts safe sandbox expressions with these rules:

### Field References

Field IDs **MUST** be wrapped in curly braces: `{fieldId}`

### Available Operators

- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `===`, `!==`, `>`, `>=`, `<`, `<=`
- Logical: `&&`, `||`, `!`
- Property access: `.length`, `.count` on field refs

### NOT Available

Function calls (`parseInt`, `parseFloat`, `.includes`, etc.), bare field names, loops, assignments

### Examples

```javascript
// Valid expressions
{f1} > 4 && {f2} < 3
{f3}.length > 0
{f4} == "Yes"

// Invalid expressions
parseInt({f1}) > 4  // No function calls
f1 > 4              // Missing braces
```

---

## Condition Operators

For `add_field_rule` conditions:

| Operator             | Description                                  |
| -------------------- | -------------------------------------------- |
| `equals`             | Value equals expected                        |
| `notEquals`          | Value does not equal expected                |
| `contains`           | String contains substring                    |
| `includes`           | Array includes value (for multi-select)      |
| `empty`              | Value is empty/null (no expected needed)     |
| `notEmpty`           | Value is not empty/null (no expected needed) |
| `greaterThan`        | Numeric comparison                           |
| `greaterThanOrEqual` | Numeric comparison                           |
| `lessThan`           | Numeric comparison                           |
| `lessThanOrEqual`    | Numeric comparison                           |

---

## System Prompts

eSheet exports system prompts optimized for AI assistants:

### Builder System Prompt

```typescript
import { BUILDER_SYSTEM_PROMPT } from '@esheet/builder';
```

Includes field type guidance, workflow instructions (call `get_form_summary` first, use `reset_form` when building from scratch), matrix vs option tool distinctions, section nesting, preview fill workflow, and text format rules.

### Renderer System Prompt

```typescript
import { RENDERER_SYSTEM_PROMPT } from '@esheet/renderer';
```

Includes fill workflow (iterate on `unfilledFields`), format rules for all field types, and guidance on using `get_form_raw`, `get_form_tree`, and `get_valid_response`.

---

## Direct Tool Execution

For advanced integrations, you can call `executeToolCall` directly:

```typescript
import { executeToolCall, type BuilderTools } from '@esheet/builder';

// builderTools is provided via onBuilderToolsReady callback
const result = executeToolCall(
  'create_field',
  { fieldType: 'text', question: 'Your name' },
  builderTools
);
```
