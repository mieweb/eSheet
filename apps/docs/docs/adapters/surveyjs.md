---
sidebar_position: 2
---

# SurveyJS Adapter

Convert between SurveyJS form schemas and eSheet `FormDefinition`. Useful for leveraging AI models that have better training data for SurveyJS output, then converting to eSheet format.

## Functions

| Function                  | Signature                                              | Description               |
| ------------------------- | ------------------------------------------------------ | ------------------------- |
| `importFromSurveyJS`      | `(schema: SurveyJSSchema) => FormDefinition`           | Import SurveyJS to eSheet |
| `convertSurveyJS`         | Alias for `importFromSurveyJS`                         | —                         |
| `convertSurveyJSToESheet` | Alias for `importFromSurveyJS`                         | —                         |
| `exportToSurveyJS`        | `(form: FormDefinition) => SurveyJSSchema`             | Export eSheet to SurveyJS |
| `isSurveyJSSchema`        | `(value: unknown) => value is SurveyJSDetectionSchema` | Type guard for detection  |

## Import from SurveyJS

```typescript
import { importFromSurveyJS } from '@esheet/adapters';

const surveyJSSchema = {
  title: 'Customer Feedback',
  pages: [
    {
      name: 'page1',
      elements: [
        { type: 'text', name: 'name', title: 'Your Name', isRequired: true },
        {
          type: 'rating',
          name: 'satisfaction',
          title: 'How satisfied are you?',
        },
      ],
    },
  ],
};

const formDefinition = importFromSurveyJS(surveyJSSchema);
```

All three function names are equivalent:

- `importFromSurveyJS` — Named export matching MCP convention
- `convertSurveyJS` — Alias
- `convertSurveyJSToESheet` — Primary implementation

## Export to SurveyJS

```typescript
import { exportToSurveyJS } from '@esheet/adapters';

const surveyJSSchema = exportToSurveyJS(formDefinition);
```

Preserves original metadata from `_sourceData` for lossless round-trip when possible.

## Type Guard

```typescript
import { isSurveyJSSchema, importFromSurveyJS } from '@esheet/adapters';

if (isSurveyJSSchema(unknownSchema)) {
  const form = importFromSurveyJS(unknownSchema);
}
```

Returns `true` if value has `pages` or `elements` array but NOT eSheet's `fields` property.

## AI System Prompt

For AI-assisted SurveyJS schema generation:

```typescript
import { SURVEYJS_SYSTEM_PROMPT } from '@esheet/adapters';

// Use in your AI system prompt configuration
```

The prompt instructs AI to:

- Output valid SurveyJS JSON (raw, without markdown fences)
- Use proper field type selection
- Structure forms with pages and elements
- Follow common SurveyJS patterns

## Field Type Mapping

### SurveyJS → eSheet

| SurveyJS Type                      | eSheet Field Type     |
| ---------------------------------- | --------------------- |
| `text`                             | `text`                |
| `comment`                          | `longtext`            |
| `radiogroup`                       | `radio`               |
| `checkbox`                         | `check`               |
| `dropdown`                         | `dropdown`            |
| `tagbox`                           | `multiselectdropdown` |
| `boolean`                          | `boolean`             |
| `rating`                           | `rating`              |
| `ranking`                          | `ranking`             |
| `matrix`                           | `singlematrix`        |
| `matrixdropdown` / `matrixdynamic` | `multimatrix`         |
| `signaturepad`                     | `signature`           |
| `image`                            | `image`               |
| `html` / `expression`              | `html`                |
| `imagepicker`                      | `radio`               |
| `file`                             | `text`                |
| `panel` / `paneldynamic`           | `section`             |
| `multipletext`                     | `multitext`           |

### Input Type Mapping

SurveyJS text field `inputType` maps to eSheet `TextInputType`:

| SurveyJS inputType | eSheet inputType |
| ------------------ | ---------------- |
| `email`            | `email`          |
| `tel`              | `tel`            |
| `url`              | `url`            |
| `date`             | `date`           |
| `datetime-local`   | `datetime-local` |
| `time`             | `time`           |
| `number`           | `number`         |
| `password`         | `password`       |

## Conditional Logic Conversion

SurveyJS conditional properties convert to eSheet `rules`:

| SurveyJS Property | eSheet Rule Effect |
| ----------------- | ------------------ |
| `visibleIf`       | `visible`          |
| `enableIf`        | `enable`           |
| `requiredIf`      | `required`         |

### Simple Expressions

```typescript
// SurveyJS: { visibleIf: "{country} = 'USA'" }
// Converts to eSheet rule:
{
  effect: 'visible',
  logic: 'AND',
  conditions: [{ conditionType: 'field', targetId: 'country', operator: 'equals', expected: 'USA' }]
}
```

### Complex Expressions

Expressions with arithmetic or multiple fields convert to expression conditions:

```typescript
// SurveyJS: { visibleIf: "{price} * {quantity} > 100" }
// Converts to eSheet rule:
{
  effect: 'visible',
  logic: 'AND',
  conditions: [{
    conditionType: 'expression',
    expression: '{price} * {quantity} > 100'
  }]
}
```

## Round-Trip Fidelity

Original SurveyJS metadata is preserved in `_sourceData`:

```typescript
const form = importFromSurveyJS(surveyJSSchema);
// form.fields[0]._sourceData = { elementType: 'text', name: 'q1', ... }

const exported = exportToSurveyJS(form);
// Original element type, name, and expressions restored
```

## Types

| Type                      | Description                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- |
| `SurveyJSDetectionSchema` | Minimal schema shape for detection: `{ pages?: unknown[]; elements?: unknown[] }` |
