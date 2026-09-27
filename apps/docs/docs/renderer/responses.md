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
| `responseReference` (registered add-on)            | `answer`                          | Serialized `ResponseReference`     |
| `diagram`                                          | `markupData`, `markupImage`       | Stroke JSON, base64 PNG            |
| `display`, `html`, `image`, `section`              | --                                | No response (presentational)       |

## Full Example Response

Responses are returned as JSON-shaped wire data; YAML is the canonical format for committed form definitions.

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

## Response Format Options

The renderer supports multiple output formats via the `getResponse()` method:

### Native Format (Default)

Returns the raw `FieldResponseMap` — structured response objects keyed by field ID:

```tsx
const response = ref.current?.getResponse();
// or explicitly:
const response = ref.current?.getResponse({ format: 'native' });
```

### FHIR QuestionnaireResponse

Export responses directly as a FHIR R4 QuestionnaireResponse resource:

```tsx
const fhirResponse = ref.current?.getResponse({
  format: 'fhir',
  fhir: {
    questionnaireUrl: 'http://example.org/Questionnaire/my-form',
    status: 'completed',
    subject: { reference: 'Patient/123' },
    author: { reference: 'Practitioner/456' },
  },
});

// Returns:
// {
//   resourceType: 'QuestionnaireResponse',
//   questionnaire: 'http://example.org/Questionnaire/my-form',
//   status: 'completed',
//   subject: { reference: 'Patient/123' },
//   author: { reference: 'Practitioner/456' },
//   authored: '2024-01-15T10:30:00Z',
//   item: [...]
// }
```

**FHIR Options:**

| Option             | Type            | Description                                                                        |
| ------------------ | --------------- | ---------------------------------------------------------------------------------- |
| `questionnaireUrl` | `string`        | Canonical URL of the questionnaire (auto-detected if imported from FHIR)           |
| `status`           | `string`        | Response status: `'in-progress'`, `'completed'`, `'amended'`, `'entered-in-error'` |
| `subject`          | `FhirReference` | Patient/subject reference (e.g., `{ reference: 'Patient/123' }`)                   |
| `author`           | `FhirReference` | Author reference                                                                   |
| `resourceId`       | `string`        | Resource ID for the QuestionnaireResponse                                          |

:::tip
If the form was imported from a FHIR Questionnaire, the `questionnaireUrl` is automatically detected from the original resource metadata.
:::

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

## Linking Independent Responses

A **form definition** describes the questions and layout. A **response** stores one
independently editable set of answers to that definition. Multiple responses can
use the same definition; linking two responses does not merge their answers or
make one response part of the other's definition.

Use a `ResponseReference` to point to another response:

```ts
import {
  parseResponseReference,
  serializeResponseReference,
} from '@esheet/core';

const reference = {
  collection: 'reviews',
  id: 'review-7',
  relationship: 'review', // Optional description of the relationship
};

const overviewResponses = {
  linked_review: { answer: serializeResponseReference(reference) },
};

const parsed = parseResponseReference(overviewResponses.linked_review.answer);
// { collection: 'reviews', id: 'review-7', relationship: 'review' }
```

Only `collection`, `id`, and optional `relationship` are allowed. The parser
returns `null` for malformed references or extra keys, and the serializer throws
for invalid input. The reference contains no target answers, display metadata,
URLs, credentials, or access grants. Save the overview and review separately under
their own response identifiers. A link to a response does not grant access to it.

### Register the Field and Supply a Host Resolver

Register the optional field type before loading a definition that uses it:

```tsx
import { useMemo } from 'react';
import type { ResponseReferenceResolver } from '@esheet/core';
import {
  createResponseReferenceProvider,
  registerResponseReferenceFieldType,
} from '@esheet/fields';
import { EsheetRenderer } from '@esheet/renderer';

registerResponseReferenceFieldType();

// hostApi is your application service. It authenticates the session and checks
// target authorization before returning approved display metadata.
const resolver: ResponseReferenceResolver = (reference, signal) =>
  hostApi.resolveResponseLink(reference, { signal });

function OverviewForm() {
  const fieldProviders = useMemo(
    () => [createResponseReferenceProvider(resolver)],
    []
  );

  return (
    <EsheetRenderer
      formDataInput={overviewDefinition}
      initialResponses={overviewResponses}
      fieldProviders={fieldProviders}
    />
  );
}
```

The committed YAML definition declares the field; the host assigns its reference
in the response:

```yaml
id: overview
title: Case overview
pages:
  - id: main
    fields:
      - id: linked_review
        fieldType: responseReference
        question: Review
```

The resolver receives a reference and an `AbortSignal`. It returns one of:

```ts
{ status: 'available', label: 'Open review', href: '/reviews/review-7' }
{ status: 'restricted', label: 'Review access is required', href: '/access/reviews' }
{ status: 'restricted' }
{ status: 'missing', label: 'Review unavailable' }
```

For restricted responses, return only wording the current user may see. The
optional restricted URL should lead to an explanatory or access-request page.
The server must also authorize every target read and write, including direct URL
navigation. Resolver output is display metadata, not an authorization decision
that the client can enforce.

Without a resolver, or when a target is missing or resolution fails, the field is
disabled. Only HTTP(S) and relative browser URLs without embedded credentials are
accepted. The field never fetches target answers. It aborts pending resolutions
when the reference or resolver changes and discards stale results. Replace the
resolver function when the active user, organization, or permission context
changes so previous-session labels disappear immediately.

Links work in read-only forms. Normal browser navigation is the default. Supply
the optional second `createResponseReferenceProvider` argument to save the
current response and navigate through your router on ordinary clicks:

```tsx
createResponseReferenceProvider(resolver, (reference, resolution) => {
  // This callback returns void. Start and handle async work inside the host.
  void saveCurrentResponse()
    .then(() => {
      if (resolution.status !== 'missing' && resolution.href) {
        router.navigate(resolution.href);
      }
    })
    .catch(showSaveError);
});
```

Modified clicks and middle clicks keep native browser behavior. If your workflow
must persist edits before those actions too, handle that in the host. Use
`ResponseReferenceLink` directly for links outside a rendered form; it accepts
the same provider or explicit `resolver` and `onNavigate` props.

The demo's **Linked Responses** card opens `/linked-responses`, which demonstrates
two YAML definitions with mutually linked, independently saved browser-local responses.
Its local storage is a demonstration of persistence, not an authorization service.

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
