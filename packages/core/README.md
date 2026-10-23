# @esheet/core

Pure TypeScript foundation for eSheet — types, state management, validation, and conditional logic. **React-free** by design; framework wrappers live in consumer packages.

## Features

- Type system with Zod schemas for full runtime validation
- Vanilla Zustand stores (`FormStore`, `UIStore`) — no React dependency
- Conditional logic engine (comparison operators + safe expression parser)
- Normalization/hydration for flat ↔ nested field conversion
- Field type registry for built-in and custom field types
- Collision-free ID generators

## Installation

```bash
npm install @esheet/core
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
} from '@esheet/core';

import { formDefinitionSchema, fieldDefinitionSchema } from '@esheet/core';
```

### State Management

```ts
import { createFormStore, createUIStore } from '@esheet/core';

const form = createFormStore();
form.getState().loadDefinition(mySchema);
form.getState().setResponse('fieldId', 'value');

const responses = form.getState().responses; // Record<string, unknown>
```

### Definition-owned initial answers

Choice options can carry `defaultOption: true`. The default stays attached
when its option ID or label is edited, and disappears when the option is
removed. Single-choice fields allow one default; checkbox and multi-select
dropdown fields allow several. Text-answer fields use `defaultAnswer`.
The builder exposes these properties in the field editor.

`defaultResponses(definition.pages)` derives response objects using the
options' current IDs and labels. `createFormStore(definition)` and
`store.getState().loadDefinition(definition)` apply these defaults once.
To load saved answers, pass the authoritative response map:
`createFormStore(definition, false, savedResponses)` or
`loadDefinition(definition, savedResponses)`. An explicit empty map means
existing unanswered fields stay blank. Clearing/resetting responses and
editing definitions do not reapply defaults. The renderer follows the same
contract through `initialResponses`.

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
import { registerFieldType, getFieldTypeMeta } from '@esheet/core';

registerFieldType({
  type: 'custom',
  label: 'Custom Field',
  category: 'basic',
  defaultProps: { question: 'New custom field' },
});
```

## Architecture

```
@esheet/core
├── types/       # FieldDefinition, FormDefinition, etc.
├── schemas/     # Zod validation schemas
├── stores/      # FormStore (data + actions), UIStore (builder UI state)
├── logic/       # Condition evaluation, expression parser
├── functions/   # normalize, hydrate, ID generators
└── registry/    # Field type metadata registration
```

## Building

Run `pnpm --filter @esheet/core build` to build the library.

## Running unit tests

Run `pnpm --filter @esheet/core test` to execute the unit tests via [Vitest](https://vitest.dev/).
