---
sidebar_position: 3
---

# MCP Adapter

Convert between MCP (Model Context Protocol) elicitation requests and eSheet `FormDefinition`. Enables AI agents to request structured input via the MCP elicitation spec (2025-11-25).

## Functions

| Function                  | Signature                                                                   | Description                  |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| `importFromMcp`           | `(schema: McpElicitationSchema, options?: ImportOptions) => FormDefinition` | Import MCP to eSheet         |
| `exportToMcp`             | `(form: FormDefinition) => McpElicitationRequest`                           | Export eSheet to MCP request |
| `isMcpElicitationRequest` | `(value: unknown) => value is McpElicitationRequest`                        | Type guard for detection     |

## Import from MCP

```typescript
import { importFromMcp } from '@esheet/adapters';

const mcpSchema = {
  type: 'object',
  title: 'User Preferences',
  properties: {
    name: { type: 'string', title: 'Full Name' },
    notifications: { type: 'boolean', title: 'Enable notifications?' },
    theme: {
      type: 'string',
      title: 'Theme',
      oneOf: [
        { const: 'light', title: 'Light Mode' },
        { const: 'dark', title: 'Dark Mode' },
      ],
    },
  },
  required: ['name'],
};

const formDefinition = importFromMcp(mcpSchema, {
  formId: 'user-prefs',
  title: 'User Preferences',
  description: 'Configure your settings',
});
```

### Import Options

```typescript
interface ImportOptions {
  formId?: string; // Form ID (default: 'mcp-form')
  title?: string; // Form title
  description?: string; // Form description
  mcpId?: string | number; // Preserved for round-trip
  mcpMessage?: string; // Preserved for round-trip
  mcpMeta?: unknown; // Non-standard envelope fields
}
```

## Export to MCP

```typescript
import { exportToMcp } from '@esheet/adapters';

const mcpRequest = exportToMcp(formDefinition);
```

Returns a full MCP JSON-RPC 2.0 `elicitation/create` request:

```json
{
  "jsonrpc": "2.0",
  "id": "...",
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "...",
    "requestedSchema": { ... }
  }
}
```

## Type Guard

```typescript
import { isMcpElicitationRequest, importFromMcp } from '@esheet/adapters';

if (isMcpElicitationRequest(unknownValue)) {
  const form = importFromMcp(unknownValue.params.requestedSchema);
}
```

Returns `true` if value is a valid MCP elicitation request envelope.

## Field Type Mapping

### MCP → eSheet

| MCP Type             | MCP Modifiers                 | eSheet Field Type                      |
| -------------------- | ----------------------------- | -------------------------------------- |
| `string`             | plain                         | `text`                                 |
| `string`             | `format: 'email'`             | `text` + `inputType: 'email'`          |
| `string`             | `format: 'uri'`               | `text` + `inputType: 'url'`            |
| `string`             | `format: 'date'`              | `text` + `inputType: 'date'`           |
| `string`             | `format: 'date-time'`         | `text` + `inputType: 'datetime-local'` |
| `string`             | `enum` or `oneOf`             | `radio`                                |
| `number` / `integer` | —                             | `text` + `inputType: 'number'`         |
| `boolean`            | —                             | `boolean`                              |
| `array`              | `items.enum` or `items.anyOf` | `check`                                |
| `object`             | nested                        | `longtext` (fallback)                  |

### eSheet → MCP

| eSheet Field Type                      | MCP Type                  | Notes                                |
| -------------------------------------- | ------------------------- | ------------------------------------ |
| `text` / `longtext`                    | `string`                  | Restores `format` from `inputType`   |
| `boolean`                              | `boolean`                 | —                                    |
| `radio` / `dropdown`                   | `string` + `enum`/`oneOf` | Uses `oneOf` if options have text    |
| `check` / `multiselectdropdown`        | `array`                   | Items with `enum`/`anyOf`            |
| `rating`                               | `integer`                 | `minimum: 1`, `maximum: optionCount` |
| `slider`                               | `number`                  | Preserves `number` vs `integer`      |
| `ranking`, `multitext`, `matrix`, etc. | **Skipped**               | No MCP equivalent                    |

## Constraint Preservation

MCP constraints are preserved in `_sourceData` for round-trip fidelity:

### String Constraints

- `minLength`, `maxLength`
- `pattern` (regex)
- `format` (email, uri, date, date-time)

### Number Constraints

- `minimum`, `maximum`
- `exclusiveMinimum`, `exclusiveMaximum`

### Array Constraints

- `minItems`, `maxItems`
- `uniqueItems`

## Types

| Type                    | Description                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| `McpElicitationSchema`  | The `requestedSchema` object in MCP requests                              |
| `McpElicitationRequest` | Full JSON-RPC 2.0 envelope with `method: 'elicitation/create'`            |
| `McpProperty`           | Union: `McpStringProp \| McpNumberProp \| McpBooleanProp \| McpArrayProp` |
| `McpStringProp`         | String property with optional `format`, `enum`, `oneOf`                   |
| `McpNumberProp`         | Number/integer property with optional `minimum`, `maximum`                |
| `McpBooleanProp`        | Boolean property                                                          |
| `McpArrayProp`          | Array property with `items.enum` or `items.anyOf`                         |
| `McpConstOption`        | `{ const: string; title: string }` for enum options                       |

## Usage Notes

- Fields without MCP equivalents (ranking, multitext, matrices) are skipped during export
- Import creates unique field IDs from MCP property names
- Export generates a complete JSON-RPC envelope, not just the schema
- Use `mcpId` and `mcpMessage` options to preserve envelope data during round-trips
