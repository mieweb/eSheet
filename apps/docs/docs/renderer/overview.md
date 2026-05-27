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
    const responses = ref.current?.getRawResponse();
    // Send responses to your API
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

| Prop               | Type                        | Default    | Description                                                         |
| ------------------ | --------------------------- | ---------- | ------------------------------------------------------------------- |
| `formDataInput`    | `FormDefinition \| string`  | _required_ | Form definition as a JavaScript object, JSON string, or YAML string |
| `className`        | `string`                    | `''`       | Additional CSS class for the root container                         |
| `initialResponses` | `FormResponse`              | --         | Pre-fill the form with existing response data                       |
| `ref`              | `Ref<EsheetRendererHandle>` | --         | Imperative handle for accessing responses and stores                |

## Ref API (`EsheetRendererHandle`)

| Method             | Returns        | Description                                    |
| ------------------ | -------------- | ---------------------------------------------- |
| `getRawResponse()` | `FormResponse` | Get current response values for all fields     |
| `getFormStore()`   | `FormStore`    | Get the underlying form state store (advanced) |
| `getUIStore()`     | `UIStore`      | Get the underlying UI state store (advanced)   |

## Features

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
