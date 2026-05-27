---
sidebar_position: 1
---

# Installation

## Requirements

- **Node.js** 20 or later
- **TypeScript** 5.5+ (recommended)

## Install Packages

Choose the scenario that matches your app:

| Scenario                 | Minimal install command                                        | Add these only if needed                                                                                |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| React renderer           | `npm install @esheet/renderer react react-dom`                 | `@esheet/core` for direct core imports/types; `@esheet/fields` for custom field component registry work |
| React builder + renderer | `npm install @esheet/builder @esheet/renderer react react-dom` | `@esheet/core` only for direct core APIs/types                                                          |
| Standalone renderer      | `npm install @esheet/renderer-standalone`                      | `@esheet/core` only if importing core types/APIs directly in host app code                              |
| Blaze renderer           | `npm install @esheet/renderer-blaze`                           | `@esheet/core` only if importing core types/APIs directly in host app code                              |
| Schema adapters          | `npm install @esheet/adapters`                                 | `@esheet/core` only if importing core types directly; typically used with renderer or builder           |

:::info
`@esheet/renderer` and `@esheet/builder` include `@esheet/core` and `@esheet/fields` transitively — no need to install them separately unless your app imports them directly.

`@esheet/renderer-standalone` and `@esheet/renderer-blaze` are separate packages that include React transitively.
:::

## React Dependency

React runtime dependencies are required for React-component usage (`@esheet/renderer`, `@esheet/builder`, `@esheet/fields`):

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

- `@esheet/core` is framework-agnostic — no React required.
- `@esheet/renderer-standalone` and `@esheet/renderer-blaze` bundle React transitively, so your host app does not need React installed.

## Verify Installation

### React renderer

```tsx
import { EsheetRenderer } from '@esheet/renderer';

console.log(EsheetRenderer);
```

### React builder

```tsx
import { EsheetBuilder } from '@esheet/builder';

console.log(EsheetBuilder);
```

### Standalone renderer

```ts
import { mountStandaloneRenderer } from '@esheet/renderer-standalone';

console.log(mountStandaloneRenderer);
```

### Blaze renderer

```ts
import { registerBlazeTemplate } from '@esheet/renderer-blaze';

console.log(registerBlazeTemplate);
```

### Schema adapters

```ts
import { importFromSurveyJS, importFromMcp } from '@esheet/adapters';

console.log(importFromSurveyJS, importFromMcp);
```

## Next Steps

- [Quick Start: Renderer](./quickstart-renderer) — Render a form and collect responses
- [Quick Start: Builder](./quickstart-builder) — Create a visual form editor
- [Quick Start: Standalone](./quickstart-standalone) — Mount the renderer without React in your app
- [Quick Start: Blaze](./quickstart-blaze) — Use the renderer in Meteor Blaze
