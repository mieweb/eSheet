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
| FHIR     | `importFromFhir`     | `exportToFhir`     | `isFhirQuestionnaire`     | Convert to/from FHIR R4 Questionnaires   |

## Common Pattern

All adapters follow a bidirectional import/export pattern:

```typescript
import { importFromSurveyJS, exportToSurveyJS } from '@esheet/adapters';

// Import: External format → eSheet
const formDefinition = importFromSurveyJS(surveyJSSchema);

// Export: eSheet → External format
const surveyJSSchema = exportToSurveyJS(formDefinition);
```

## Built-in Auto-Detection (Components)

You rarely need to call adapter functions directly. Both `EsheetRenderer` and `EsheetBuilder` automatically detect and convert foreign schemas at input — just pass the schema straight through:

```tsx
// All of these work without any manual adapter calls
<EsheetRenderer formDataInput={fhirQuestionnaire} />
<EsheetRenderer formDataInput={surveyJSSchema} />
<EsheetRenderer formDataInput={mcpElicitationEnvelope} />

<EsheetBuilder definition={fhirQuestionnaire} />
<EsheetBuilder definition={surveyJSSchema} />
```

The detection order is: **FHIR → MCP → SurveyJS → native eSheet**.

> **Renderer only:** Pass `strict={true}` to disable auto-detection and require a native `FormDefinition`. The Builder always auto-detects with no bypass option.

Call the adapter functions directly only when you need to transform schemas outside of these components (e.g. in a server-side pipeline or before persisting to a database).

## Auto-Detection

Use type guards to detect the schema format when handling unknown input:

```typescript
import {
  isSurveyJSSchema,
  isMcpElicitationRequest,
  isFhirQuestionnaire,
  importFromSurveyJS,
  importFromMcp,
  importFromFhir,
} from '@esheet/adapters';
import type { FormDefinition } from '@esheet/core';

function detectAndConvert(unknownSchema: unknown): FormDefinition | null {
  if (isSurveyJSSchema(unknownSchema)) {
    return importFromSurveyJS(unknownSchema);
  }
  if (isMcpElicitationRequest(unknownSchema)) {
    return importFromMcp(unknownSchema.params.requestedSchema);
  }
  if (isFhirQuestionnaire(unknownSchema)) {
    return importFromFhir(unknownSchema);
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

  // FHIR Adapter
  importFromFhir,
  exportToFhir,
  importResponseFromFhir,
  exportResponseToFhir,
  isFhirQuestionnaire,
  isFhirQuestionnaireResponse,
  mapFhirTypeToEsheet,
  mapEsheetTypeToFhir,
  FHIR_EXT,

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
  type FhirQuestionnaire,
  type FhirQuestionnaireResponse,
  type FhirImportOptions,
  type FhirExportOptions,
  type FhirFieldMeta,
  type FhirFormMeta,
} from '@esheet/adapters';
```

See the [SurveyJS Adapter](./surveyjs.md), [MCP Adapter](./mcp.md), and [FHIR Adapter](./fhir.md) pages for detailed documentation.
