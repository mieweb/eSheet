---
sidebar_position: 1
---

# Renderer Overview

The `EsheetRenderer` component provides a read-only form fill-out experience. It renders a form definition, evaluates conditional logic in real-time, and collects user responses.

Standalone and Blaze integrations wrap this same renderer core:

- `@esheet/renderer-standalone`: [Quick Start: Standalone](../getting-started/quickstart-standalone)
- `@esheet/renderer-blaze`: [Quick Start: Blaze](../getting-started/quickstart-blaze)

## When to Use

Use the Renderer when you need:

- **Form fill-out** -- end users answering questions
- **Response collection** -- gathering data via forms
- **Pre-filled forms** -- displaying forms with existing answers
- **Conditional forms** -- forms where field visibility changes based on answers

## Basic Usage

```tsx
import { useRef } from 'react';
import { EsheetRenderer } from '@esheet/renderer';
import type { EsheetRendererHandle } from '@esheet/renderer';

function SurveyPage() {
  const ref = useRef<EsheetRendererHandle>(null);

  const handleSubmit = () => {
    const result = ref.current?.getValidResponse();
    if (!result) return;
    if (result.errors.length > 0) {
      // show errors to user
      return;
    }
    // Send result.response to your API
  };

  return (
    <div>
      <EsheetRenderer ref={ref} formDataInput={formDefinition} />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

## Props Reference

| Prop                   | Type                             | Default    | Description                                                                                                                                                                                |
| ---------------------- | -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `formDataInput`        | `FormDefinition \| string`       | _required_ | Form definition — accepts eSheet `FormDefinition`, FHIR R4 Questionnaire, SurveyJS schema, MCP elicitation envelope, or any as a JSON/YAML string. Auto-detected and converted internally. |
| `className`            | `string`                         | `''`       | Additional CSS class for the root container                                                                                                                                                |
| `initialResponses`     | `FormResponse`                   | --         | Pre-fill the form with existing response data                                                                                                                                              |
| `allowDangerousJS`     | `boolean`                        | `false`    | Allow JS calculations and `conditionType: 'js'` — see [Dangerous JS](../advanced/dangerous-js)                                                                                             |
| `strict`               | `boolean`                        | `false`    | Disable auto-detection — requires a native eSheet `FormDefinition`. Fires `onValidationError` if the input does not conform.                                                               |
| `onReady`              | `() => void`                     | --         | Called when the form definition is parsed and loaded                                                                                                                                       |
| `touchMode`            | `boolean \| 'auto'`              | --         | Touch mode: `true`, `false`, `'auto'`, or omit for CSS-only                                                                                                                                |
| `onTouchModeChange`    | `(enabled: boolean) => void`     | --         | Callback when touch mode changes                                                                                                                                                           |
| `onRendererToolsReady` | `(tools: RendererTools) => void` | --         | Called with MCP tool handler when ready                                                                                                                                                    |
| `collab`               | `CollabDecorations`              | --         | Host-supplied presence and proposal decorations — see [Collaboration](../advanced/collaboration.md)                                                                                        |
| `ref`                  | `Ref<EsheetRendererHandle>`      | --         | Imperative handle for accessing responses and stores                                                                                                                                       |

## Ref API (`EsheetRendererHandle`)

| Method                  | Returns                                                         | Description                                                                                                                            |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `getRawResponse()`      | `FormResponse`                                                  | Get current response values for all fields                                                                                             |
| `getResponse(options?)` | `FormResponse \| FhirQuestionnaireResponse`                     | Get responses in native or FHIR format. Pass `{ format: 'fhir' }` to get a FHIR `QuestionnaireResponse`. See [Responses](./responses). |
| `getValidResponse()`    | `{ response: FormResponse \| null, errors: ValidationError[] }` | Validate + get responses                                                                                                               |
| `getFormStore()`        | `FormStore`                                                     | Get the underlying form state store (advanced)                                                                                         |
| `getUIStore()`          | `UIStore`                                                       | Get the underlying UI state store (advanced)                                                                                           |
| `isTouchModeEnabled()`  | `boolean`                                                       | Check if touch mode is currently enabled                                                                                               |
| `setTouchMode(enabled)` | `void`                                                          | Manually enable/disable touch mode                                                                                                     |
| `resetTouchMode()`      | `void`                                                          | Reset to auto-detection (when `touchMode="auto"`)                                                                                      |

## Features

## Touch Mode

The renderer supports touch-friendly sizing for mobile devices. See [Touch Mode](./touch-mode) for details.

## Conditional Logic

The renderer evaluates conditional rules in real-time as users answer questions:

- **Visibility rules** -- fields appear/disappear based on other answers
- **Enable rules** -- fields become interactive/disabled
- **Required rules** -- fields become required dynamically

## Input Formats

The `formData` prop accepts three formats:

```tsx
// 1. JavaScript object
<EsheetRenderer formDataInput={formDefinitionObject} />

// 2. JSON string
<EsheetRenderer formDataInput='{"id":"my-form","fields":[...]}' />

// 3. YAML string
<EsheetRenderer formDataInput={yamlString} />
```

The renderer auto-detects the format and parses accordingly.

## Responsive Layout

The renderer renders as a single-column layout:

- Maximum width of `42rem` (`max-w-2xl`)
- Horizontally centered
- Padding on all sides
- Sets its own background and text colors

## Field Components

The renderer uses the same field components from `@esheet/fields` as the builder. All 19 field types are supported with full interactivity (text input, option selection, drawing pads, drag-to-rank, etc.).
