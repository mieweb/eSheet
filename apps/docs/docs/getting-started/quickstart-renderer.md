---
sidebar_position: 3
---

# Quick Start: Renderer

Render a form and collect user responses in your React application.

## Basic Example

```tsx
import { useRef } from 'react';
import { EsheetRenderer } from '@esheet/renderer';
import type { EsheetRendererHandle } from '@esheet/renderer';
import type { FormDefinition } from '@esheet/core';

const myForm: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  title: 'Feedback Survey',
  fields: [
    {
      id: 'name',
      fieldType: 'text',
      question: 'Your Name',
      required: true,
      inputType: 'string',
    },
    {
      id: 'rating',
      fieldType: 'rating',
      question: 'How would you rate our service?',
      options: [
        { id: 'r1', value: '1' },
        { id: 'r2', value: '2' },
        { id: 'r3', value: '3' },
        { id: 'r4', value: '4' },
        { id: 'r5', value: '5' },
      ],
    },
    {
      id: 'comments',
      fieldType: 'longtext',
      question: 'Additional Comments',
    },
  ],
};

function App() {
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const handleSubmit = () => {
    const responses = rendererRef.current?.getResponse();
    console.log('Form responses:', responses);
  };

  return (
    <div>
      <EsheetRenderer ref={rendererRef} formData={myForm} />
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
const responses = ref.current?.getResponse();
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
  formData={myForm}
  initialResponses={{
    name: { answer: 'Jane Doe' },
    rating: { selected: { id: 'r4', value: '4' } },
  }}
/>
```

## Accepting JSON/YAML Strings

The renderer accepts form definitions as objects, JSON strings, or YAML strings:

```tsx
// JSON string
<EsheetRenderer formData='{"schemaType":"mieforms-v1.0","fields":[...]}' />

// YAML string
<EsheetRenderer formData={yamlString} />
```

## Props

| Prop               | Type                        | Default    | Description                               |
| ------------------ | --------------------------- | ---------- | ----------------------------------------- |
| `formData`         | `FormDefinition \| string`  | _required_ | Form definition (object, JSON, or YAML)   |
| `className`        | `string`                    | `''`       | Additional CSS class for the root         |
| `initialResponses` | `FormResponse`              | --         | Pre-fill response data                    |
| `ref`              | `Ref<EsheetRendererHandle>` | --         | Imperative handle for response collection |

## Ref API (`EsheetRendererHandle`)

| Method           | Returns        | Description                            |
| ---------------- | -------------- | -------------------------------------- |
| `getResponse()`  | `FormResponse` | Current response values for all fields |
| `getFormStore()` | `FormStore`    | The underlying form state store        |
| `getUIStore()`   | `UIStore`      | The underlying UI state store          |

## What's Next

- [Response Collection](../renderer/responses) -- Detailed guide on working with responses
- [Validation](../renderer/validation) -- Validate form responses programmatically
- [Field Types](../field-types) -- See all available field types
