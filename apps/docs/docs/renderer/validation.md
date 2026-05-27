---
sidebar_position: 3
---

# Form Validation

eSheet provides a validation system that respects conditional logic -- hidden fields are excluded from validation.

## Validation API

Validation functions are exported from `@esheet/core`:

```tsx
import { validateForm, validateField } from '@esheet/core';
```

## Validation Rules

```tsx
const handleSubmit = () => {
  const formStore = ref.current?.getFormStore();
  if (!formStore) return;

  const errors = formStore.getState().getErrors();

  if (errors.length > 0) {
    console.log('Validation errors:', errors);
    return;
  }

  // Form is valid -- proceed with submission
  const responses = ref.current.getRawResponse();
  submitToServer(responses);
};
```

## Error Shape

```tsx
const formStore = ref.current?.getFormStore();
const fieldErrors = formStore?.getState().getFieldErrors('field_id');

if (fieldErrors && fieldErrors.length > 0) {
  console.log('Field errors:', fieldErrors);
}
```

### Required Fields

When a field has `required: true` (or is made required by a conditional rule), it must have a non-empty response:

| Field Type                                         | "Empty" definition                           |
| -------------------------------------------------- | -------------------------------------------- |
| `text`, `longtext`                                 | `answer` is undefined, null, or empty string |
| `radio`, `dropdown`, `boolean`, `rating`, `slider` | `selected` is undefined                      |
| `check`, `multiselectdropdown`, `ranking`          | `selected` is undefined or empty array       |
| `multitext`                                        | All values in `multitextAnswers` are empty   |
| `singlematrix`, `multimatrix`                      | Not all rows have selections                 |
| `signature`                                        | `signatureData` is undefined or empty        |
| `diagram`                                          | `markupData` is undefined or empty           |

### Conditional Awareness

Validation automatically respects conditional logic:

- **Hidden fields** (visibility = false) -> **not validated**, even if required
- **Disabled fields** are still validated by the current core validator unless hidden by visibility logic
- **Conditionally required fields** -> validated only when the `required` rule evaluates to true

This means users are never blocked by fields they can't see or interact with.

Validation errors are returned as an array:

```typescript
interface FieldError {
  fieldId: string;
  message: string;
}
```

Example:

```json
[
  { "fieldId": "name", "message": "This field is required" },
  { "fieldId": "email", "message": "This field is required" }
]
```

## Example: Submit with Validation

```tsx
import { useRef, useState } from 'react';
import { EsheetRenderer } from '@esheet/renderer';
import type { EsheetRendererHandle } from '@esheet/renderer';

function ValidatedForm({ formData }) {
  const ref = useRef<EsheetRendererHandle>(null);
  const [errors, setErrors] = useState([]);

  const handleSubmit = () => {
    const formStore = ref.current?.getFormStore();
    if (!formStore) return;

    const validationErrors = formStore.getState().getErrors();

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    const responses = ref.current.getRawResponse();
    // Submit responses...
  };

  return (
    <div>
      <EsheetRenderer ref={ref} formDataInput={formData} />
      {errors.length > 0 && (
        <div style={{ color: 'red', margin: '1rem 0' }}>
          <p>Please fix the following errors:</p>
          <ul>
            {errors.map((err) => (
              <li key={err.fieldId}>
                {err.message} ({err.fieldId})
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```
