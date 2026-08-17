---
sidebar_position: 3
---

# Quick Start: Renderer

Render a form and collect user responses in your React application.

## Choose Your Integration

| Use case             | Package                                                  |
| -------------------- | -------------------------------------------------------- |
| React app            | `@esheet/renderer` (this page)                           |
| Non-React / plain JS | [`@esheet/renderer-standalone`](./quickstart-standalone) |
| Meteor Blaze         | [`@esheet/renderer-blaze`](./quickstart-blaze)           |

> YAML is eSheet's canonical format for committed form layouts. You can also pass plain objects or JSON strings, and the renderer auto-detects both serialization formats.

## Basic Example

```tsx
import { useRef } from 'react';
import { EsheetRenderer } from '@esheet/renderer';
import type { EsheetRendererHandle } from '@esheet/renderer';

const myForm = `
id: feedback-survey
title: Feedback Survey
pages:
  - id: feedback
    fields:
      - id: name
        fieldType: text
        question: Your Name
        required: true
        inputType: string
      - id: rating
        fieldType: rating
        question: How would you rate our service?
        options:
          - id: r1
            value: '1'
          - id: r2
            value: '2'
          - id: r3
            value: '3'
          - id: r4
            value: '4'
          - id: r5
            value: '5'
      - id: comments
        fieldType: longtext
        question: Additional Comments
`;

function App() {
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const handleSubmit = () => {
    const result = rendererRef.current?.getValidResponse();
    if (!result) return;

    if (result.errors.length > 0) {
      console.log('Validation errors:', result.errors);
      return;
    }

    console.log('Valid form responses:', result.response);
  };

  return (
    <div>
      <EsheetRenderer ref={rendererRef} formDataInput={myForm} />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

## Collecting Responses

The renderer exposes an imperative API via `ref`:

```tsx
const ref = useRef<EsheetRendererHandle>(null);

// Get all responses
const responses = ref.current?.getRawResponse();
// => { name: { answer: 'John' }, rating: { selected: { id: 'r4', value: '4' } }, ... }

// Access the underlying stores (advanced)
const formStore = ref.current?.getFormStore();
const uiStore = ref.current?.getUIStore();
```

### Response Shape

Responses are typed as `FormResponse = Record<string, FieldResponse>`, where each key is a field ID:

```typescript
interface FieldResponse {
  answer?: string; // text, longtext
  selected?: // radio, dropdown, boolean, rating, slider,
  | SelectedOption //   check, multiselectdropdown, ranking
    | SelectedOption[] //   (SelectedOption = { id, value })
    | Record<string, SelectedOption | SelectedOption[]>; // matrix
  multitextAnswers?: Record<string, string>; // multitext
  signatureData?: string; // signature (stroke data)
  signatureImage?: string; // signature (base64 PNG)
  markupData?: string; // diagram (stroke data)
  markupImage?: string; // diagram (base64 PNG)
}
```

## Pre-filling Responses

Pass `initialResponses` to pre-populate the form:

```tsx
<EsheetRenderer
  ref={rendererRef}
  formDataInput={myForm}
  initialResponses={{
    name: { answer: 'Jane Doe' },
    rating: { selected: { id: 'r4', value: '4' } },
  }}
/>
```

## Accepting YAML/JSON Strings

The renderer accepts form definitions as objects, YAML strings, or JSON strings. YAML is the recommended format for committed definitions:

```tsx
// YAML string
<EsheetRenderer formDataInput={yamlString} />

// JSON string for wire/API interchange
<EsheetRenderer formDataInput='{"id":"my-form","pages":[]}' />
```

## Props

| Prop                   | Type                             | Default    | Description                                                 |
| ---------------------- | -------------------------------- | ---------- | ----------------------------------------------------------- |
| `formDataInput`        | `FormDefinition \| string`       | _required_ | Form definition (object, YAML, JSON, FHIR, MCP, SurveyJS)   |
| `className`            | `string`                         | `''`       | Additional CSS class for the root                           |
| `initialResponses`     | `FormResponse`                   | --         | Pre-fill response data                                      |
| `allowDangerousJS`     | `boolean`                        | `false`    | Allow JS calculations and `conditionType: 'js'`             |
| `strict`               | `boolean`                        | `false`    | Require a native eSheet FormDefinition; skip auto-detection |
| `onReady`              | `() => void`                     | --         | Called when the form definition is loaded                   |
| `touchMode`            | `boolean \| 'auto'`              | --         | Touch mode: `true`, `false`, `'auto'`, or omit for CSS      |
| `onTouchModeChange`    | `(enabled: boolean) => void`     | --         | Callback when touch mode changes                            |
| `onRendererToolsReady` | `(tools: RendererTools) => void` | --         | Called with MCP tool handler when ready                     |
| `ref`                  | `Ref<EsheetRendererHandle>`      | --         | Imperative handle for response collection                   |

## Ref API (`EsheetRendererHandle`)

| Method                  | Returns                                                         | Description                                       |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `getRawResponse()`      | `FormResponse`                                                  | Current response values for all fields            |
| `getResponse(options?)` | `FormResponse \| FhirQuestionnaireResponse`                     | Responses in native or FHIR format                |
| `getValidResponse()`    | `{ response: FormResponse \| null, errors: ValidationError[] }` | Validate + get responses                          |
| `getFormStore()`        | `FormStore`                                                     | The underlying form state store                   |
| `getUIStore()`          | `UIStore`                                                       | The underlying UI state store                     |
| `isTouchModeEnabled()`  | `boolean`                                                       | Check if touch mode is currently enabled          |
| `setTouchMode(enabled)` | `void`                                                          | Manually enable/disable touch mode                |
| `resetTouchMode()`      | `void`                                                          | Reset to auto-detection (when `touchMode="auto"`) |

## What's Next

- [Response Collection](../renderer/responses) -- Detailed guide on working with responses
- [Validation](../renderer/validation) -- Validate form responses programmatically
- [Field Types](../field-types) -- See all available field types
- [Quick Start: Standalone](./quickstart-standalone) -- Mount renderer in non-React apps
- [Quick Start: Blaze](./quickstart-blaze) -- Register renderer in Meteor Blaze
