# @msheet/core

Pure TypeScript foundation for mSheet — types, state management, validation, and conditional logic. **React-free** by design; framework wrappers live in consumer packages.

## Features

- Type system with Zod schemas for full runtime validation
- Vanilla Zustand stores (`FormStore`, `UIStore`) — no React dependency
- Conditional logic engine (comparison operators + safe expression parser)
- Normalization/hydration for flat ↔ nested field conversion
- Field type registry for built-in and custom field types
- Collision-free ID generators

## Installation

```bash
npm install @msheet/core
```

## Key Exports

### Types & Schemas

```ts
import type {
  FieldDefinition,
  FormDefinition,
  FormResponse,
  FieldType,
  FieldOption,
  ConditionalRule,
} from '@msheet/core';

import { formDefinitionSchema, fieldDefinitionSchema } from '@msheet/core';
```

### State Management

```ts
import { createFormStore, createUIStore } from '@msheet/core';

const form = createFormStore();
form.getState().loadDefinition(mySchema);
form.getState().setResponse('fieldId', 'value');

const responses = form.getState().responses; // Record<string, unknown>
```

### Selectors

```ts
const field = form.getState().getField('fieldId');
const isVisible = form.getState().isVisible('fieldId');
const isEnabled = form.getState().isEnabled('fieldId');
const isRequired = form.getState().isRequired('fieldId');
const errors = form.getState().getFieldErrors('fieldId');
```

### Builder Actions

```ts
form.getState().addField('text', { parentId: 'sectionId' });
form.getState().updateField('fieldId', { question: 'New text' });
form.getState().removeField('fieldId');
form.getState().moveField('fieldId', 2, 'newParentId');
```

### Field Registry

```ts
import { registerFieldType, getFieldTypeMeta } from '@msheet/core';

registerFieldType({
  type: 'custom',
  label: 'Custom Field',
  category: 'basic',
  defaultProps: { question: 'New custom field' },
});
```

## Architecture

```
@msheet/core
├── types/       # FieldDefinition, FormDefinition, etc.
├── schemas/     # Zod validation schemas
├── stores/      # FormStore (data + actions), UIStore (builder UI state)
├── logic/       # Condition evaluation, expression parser
├── functions/   # normalize, hydrate, ID generators
└── registry/    # Field type metadata registration
```

## Building

Run `nx build @msheet/core` to build the library.

## Running unit tests

Run `nx test @msheet/core` to execute the unit tests via [Vitest](https://vitest.dev/).
