---
sidebar_position: 5
---

# Quick Start: Blaze Renderer

Register eSheet Renderer as a Blaze template. React is bundled inside `@esheet/renderer-blaze` — no separate React install needed in your Meteor app.

## Install

```bash
npm install @esheet/renderer-blaze
```

If your app imports core types such as `FormDefinition` directly, also add `@esheet/core` as a dependency.

## Register the Blaze Template

```ts
import { registerBlazeTemplate } from '@esheet/renderer-blaze';

const registered = registerBlazeTemplate();

if (!registered) {
  throw new Error(
    'Failed to register Blaze template: required globals are missing.'
  );
}
```

By default, `registerBlazeTemplate()` creates the template as `Template.esheetRenderer`.

## Use a Custom Template Name

```ts
const registered = registerBlazeTemplate('esheetRendererSurvey');

if (!registered) {
  throw new Error('Failed to register Blaze template');
}
```

This registers `Template.esheetRendererSurvey`.

## Access Responses in the Template Instance

After render, the instance exposes:

- `this.getResponse()`
- `this.getValidResponse()`

Example pattern:

```ts
Template.esheetRenderer.onRendered(function () {
  const result = this.getValidResponse?.();

  if (!result) {
    console.warn('Renderer not ready yet');
    return;
  }

  if (result.errors.length > 0) {
    console.warn('Validation errors:', result.errors);
    return;
  }

  console.log('Valid response:', result.response);
});
```

## Troubleshooting

`registerBlazeTemplate()` returns `false` when the required Blaze globals are not present at call time:

| Missing global | Meaning              |
| -------------- | -------------------- |
| `Template`     | Blaze not loaded yet |
| `Blaze`        | Blaze not loaded yet |
| `HTML`         | Blaze not loaded yet |

Call `registerBlazeTemplate()` after Blaze has fully initialized (e.g. in a Meteor startup callback).
