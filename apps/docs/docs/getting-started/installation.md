---
sidebar_position: 1
---

# Installation

## Requirements

- **Node.js** 20 or later
- **React** 19 or later
- **TypeScript** 5.5+ (recommended)

## Install Packages

Install the packages you need. Most applications will use either the **builder** (for form authoring) or the **renderer** (for form fill-out), or both.

### Editor (form builder)

```bash
npm install @esheet/builder @esheet/fields @esheet/core
```

### Renderer (form fill-out)

```bash
npm install @esheet/renderer @esheet/fields @esheet/core
```

### Both

```bash
npm install @esheet/builder @esheet/renderer @esheet/fields @esheet/core
```

:::info
`@esheet/builder` and `@esheet/renderer` depend on `@esheet/core` and `@esheet/fields`. Installing all related packages together is still recommended for version alignment.
:::

## React Dependency

All packages require React 19+:

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

## Verify Installation

```tsx
import { EsheetBuilder } from '@esheet/builder';
import { EsheetRenderer } from '@esheet/renderer';
import type { FormDefinition } from '@esheet/core';

// If these imports resolve without errors, you're good to go!
console.log('eSheet installed successfully');
```

## Next Steps

- [Quick Start: Builder](./quickstart-builder) -- Create your first form editor
- [Quick Start: Renderer](./quickstart-renderer) -- Render a form and collect responses
