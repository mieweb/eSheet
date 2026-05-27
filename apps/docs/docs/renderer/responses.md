---
sidebar_position: 2
---

# Collecting & Pre-filling Responses

This guide covers how to collect form responses from the renderer and how to pre-fill forms with existing data.

## Collecting Responses

### Via Ref API

The primary way to get responses is through the imperative ref:

```tsx
import { useRef } from 'react';
import { EsheetRenderer } from '@esheet/renderer';
import type { EsheetRendererHandle } from '@esheet/renderer';

function MyForm() {
  const ref = useRef<EsheetRendererHandle>(null);

  const handleSubmit = () => {
    const result = ref.current?.getValidResponse();
    if (!result) return;
    if (result.errors.length > 0) {
      console.log('Validation errors:', result.errors);
      return;
    }
    console.log('Valid responses:', result.response);
  };

  return (
    <>
      <EsheetRenderer ref={ref} formDataInput={myForm} />
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
```

### Response Shape by Field Type

| Field Type                                         | Response Property                 | Shape                              |
| -------------------------------------------------- | --------------------------------- | ---------------------------------- |
| `text`, `longtext`                                 | `answer`                          | `string`                           |
| `radio`, `dropdown`, `boolean`, `rating`, `slider` | `selected`                        | `SelectedOption` (`{ id, value }`) |
| `check`, `multiselectdropdown`, `ranking`          | `selected`                        | `SelectedOption[]`                 |
| `multitext`                                        | `multitextAnswers`                | `Record<optionId, string>`         |
| `singlematrix`                                     | `selected`                        | `Record<rowId, SelectedOption>`    |
| `multimatrix`                                      | `selected`                        | `Record<rowId, SelectedOption[]>`  |
| `signature`                                        | `signatureData`, `signatureImage` | Stroke JSON, base64 PNG            |
| `diagram`                                          | `markupData`, `markupImage`       | Stroke JSON, base64 PNG            |
| `display`, `html`, `image`, `section`              | --                                | No response (presentational)       |

## Full Example Response

```json
{
  "patient_name": {
    "answer": "Jane Doe"
  },
  "visit_reason": {
    "selected": { "id": "opt2", "value": "Follow-up" }
  },
  "symptoms": {
    "selected": [
      { "id": "s1", "value": "Headache" },
      { "id": "s3", "value": "Fatigue" }
    ]
  },
  "vitals": {
    "multitextAnswers": {
      "bp": "120/80",
      "hr": "72"
    }
  },
  "severity_matrix": {
    "selected": {
      "row_head": { "id": "col_mild", "value": "Mild" },
      "row_back": { "id": "col_severe", "value": "Severe" }
    }
  },
  "patient_signature": {
    "signatureData": "[{\"points\":[{\"x\":0.1,\"y\":0.2}...]}]",
    "signatureImage": "data:image/png;base64,iVBOR..."
  }
}
```

## Pre-filling Responses

Pass `initialResponses` to populate the form with existing data:

```tsx
const existingResponses = {
  patient_name: { answer: 'Jane Doe' },
  visit_reason: { selected: { id: 'opt2', value: 'Follow-up' } },
};

<EsheetRenderer
  ref={ref}
  formDataInput={myForm}
  initialResponses={existingResponses}
/>;
```

This is useful for:

- **Editing previously submitted forms**
- **Resuming partially completed forms**
- **Displaying read-only form data** (combine with disabled styling)

## Hydrating Responses

To create a human-readable export that joins questions with answers, use `hydrateResponse()` from `@esheet/core`:

```tsx
import { hydrateResponse } from '@esheet/core';

const handleExport = () => {
  const formStore = ref.current?.getFormStore();
  if (!formStore) return;

  const state = formStore.getState();
  const hydrated = state.hydrateResponse();
  // hydrated includes both question text and answer values
};
```

## Direct Store Access

For advanced scenarios, access the underlying stores:

```tsx
const formStore = ref.current?.getFormStore();
const uiStore = ref.current?.getUIStore();

// Read state
const state = formStore.getState();
const allResponses = state.responses;
const specificField = state.getField('field_id');
const fieldResponse = state.getResponse('field_id');

// Check conditional states
const isVisible = state.isVisible('field_id');
const isEnabled = state.isEnabled('field_id');
const isRequired = state.isRequired('field_id');
```

:::warning
Direct store access is an advanced API. The store's internal structure may change between versions. Prefer using `getRawResponse()` (or `getValidResponse()` for validated submission) for standard response collection.
:::
