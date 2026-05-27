---
sidebar_position: 4
---

# Quick Start: Standalone Renderer

Mount eSheet Renderer into any DOM element. No React required in your own app code — React is bundled inside `@esheet/renderer-standalone`.

## Install

```bash
npm install @esheet/renderer-standalone
```

If your app imports core types such as `FormDefinition` directly, also add `@esheet/core` as a dependency.

## Basic Usage

```ts
import { mountStandaloneRenderer } from '@esheet/renderer-standalone';
import type { FormDefinition } from '@esheet/core';

const demoForm: FormDefinition = {
  id: 'standalone-demo',
  title: 'Standalone Renderer Demo',
  fields: [
    {
      id: 'name',
      fieldType: 'text',
      question: 'What is your name?',
      required: true,
    },
  ],
};

const mountElement = document.getElementById('renderer-mount');

if (mountElement) {
  const standalone = mountStandaloneRenderer(mountElement, {
    formData: demoForm,
  });

  console.log('Current response:', standalone.getResponse());
}
```

## HTML Mount Element + Submit Button

```html
<div id="renderer-mount"></div>
<button id="submit-btn" type="button">Submit</button>
```

```ts
const submitButton = document.getElementById('submit-btn');

if (submitButton instanceof HTMLButtonElement) {
  submitButton.addEventListener('click', () => {
    const result = standalone.getValidResponse();

    if (!result) {
      alert('Renderer is not ready yet.');
      return;
    }

    if (result.errors.length > 0) {
      const messages = result.errors
        .map((err) => `Field ${err.fieldId}: ${err.message}`)
        .join('\n');
      alert(`Validation failed:\n${messages}`);
      return;
    }

    alert(
      `Form is valid!\nResponses: ${JSON.stringify(result.response, null, 2)}`
    );
  });
}
```

## Handle API

`mountStandaloneRenderer` returns an `EsheetRendererStandaloneHandle` with three methods:

| Method               | Returns                          | Description                                                   |
| -------------------- | -------------------------------- | ------------------------------------------------------------- |
| `getResponse()`      | response payload or `null`       | Current field responses. `null` before the renderer is ready. |
| `getValidResponse()` | `{ response, errors }` or `null` | Validates before returning. `null` before renderer is ready.  |
| `unmount()`          | `void`                           | Tears down the React root and cleans up resources.            |

## Cleanup

Call `unmount()` when the host page/element is removed:

```ts
standalone.unmount();
```

This avoids keeping detached React roots alive.
