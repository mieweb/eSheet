---
sidebar_position: 1
---

# Adapters Overview

The `@esheet/adapters` package provides bidirectional converters between eSheet `FormDefinition` and external form schema formats like SurveyJS and MCP elicitation requests.

## Installation

```bash
npm install @esheet/adapters
```

## Available Adapters

| Adapter  | Import Function      | Export Function    | Type Guard                | Description                              |
| -------- | -------------------- | ------------------ | ------------------------- | ---------------------------------------- |
| SurveyJS | `importFromSurveyJS` | `exportToSurveyJS` | `isSurveyJSSchema`        | Convert to/from SurveyJS form schemas    |
| MCP      | `importFromMcp`      | `exportToMcp`      | `isMcpElicitationRequest` | Convert to/from MCP elicitation requests |

## Common Pattern

All adapters follow a bidirectional import/export pattern:

```typescript
import { importFromSurveyJS, exportToSurveyJS } from '@esheet/adapters';

// Import: External format → eSheet
const formDefinition = importFromSurveyJS(surveyJSSchema);

// Export: eSheet → External format
const surveyJSSchema = exportToSurveyJS(formDefinition);
```

## Auto-Detection

Use type guards to detect the schema format when handling unknown input:

```typescript
import {
  isSurveyJSSchema,
  isMcpElicitationRequest,
  importFromSurveyJS,
  importFromMcp,
} from '@esheet/adapters';
import type { FormDefinition } from '@esheet/core';

function detectAndConvert(unknownSchema: unknown): FormDefinition | null {
  if (isSurveyJSSchema(unknownSchema)) {
    return importFromSurveyJS(unknownSchema);
  }
  if (isMcpElicitationRequest(unknownSchema)) {
    return importFromMcp(unknownSchema.params.requestedSchema);
  }
  return null;
}
```

## Round-Trip Fidelity

Adapters preserve original metadata in `_sourceData` to enable lossless round-trips:

```typescript
const form = importFromSurveyJS(surveyJSSchema);
// form.fields[0]._sourceData contains original SurveyJS element

const exported = exportToSurveyJS(form);
// Original field names, types, and properties restored
```

## All Exports

```typescript
import {
  // SurveyJS Adapter
  importFromSurveyJS,
  convertSurveyJS, // Alias
  convertSurveyJSToESheet, // Alias
  exportToSurveyJS,
  isSurveyJSSchema,
  SURVEYJS_SYSTEM_PROMPT,

  // MCP Adapter
  importFromMcp,
  exportToMcp,
  isMcpElicitationRequest,

  // Types
  type SurveyJSDetectionSchema,
  type McpElicitationSchema,
  type McpElicitationRequest,
  type McpProperty,
  type McpStringProp,
  type McpNumberProp,
  type McpBooleanProp,
  type McpArrayProp,
  type McpConstOption,
} from '@esheet/adapters';
```

See the [SurveyJS Adapter](./surveyjs.md) and [MCP Adapter](./mcp.md) pages for detailed documentation.
