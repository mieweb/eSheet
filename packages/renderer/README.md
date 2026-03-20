# @msheet/renderer

Read-only questionnaire form renderer for mSheet. Renders forms in fill-out mode with conditional visibility logic.

## Features

- ✅ Renders all 19 mSheet field types (reuses `@msheet/fields` components)
- ✅ Conditional visibility enforcement (fields/sections hide based on logic rules)
- ✅ Section nesting with recursive rendering
- ✅ Initial response pre-fill support
- ✅ YAML/JSON schema parsing with Zod validation
- ✅ Ref API for collecting responses
- ✅ TypeScript-first with full type safety

## Installation

```bash
npm install @msheet/renderer @msheet/fields @msheet/core
```

## Usage

### Basic Example

```tsx
import { MsheetRenderer } from '@msheet/renderer';
import type { FormDefinition } from '@msheet/core';

const myForm: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  title: 'Patient Intake',
  fields: [
    {
      id: 'name',
      fieldType: 'text',
      question: 'Full Name',
      required: true,
    },
    {
      id: 'age',
      fieldType: 'text',
      question: 'Age',
    },
  ],
};

function App() {
  return (
    <div className="app-container">
      <MsheetRenderer formData={myForm} />
    </div>
  );
}
```

### With Response Collection

```tsx
import { useRef } from 'react';
import { MsheetRenderer, type MsheetRendererHandle } from '@msheet/renderer';

function App() {
  const rendererRef = useRef<MsheetRendererHandle>(null);

  const handleSubmit = () => {
    const responses = rendererRef.current?.getResponse();
    console.log('Form responses:', responses);
    // { name: '...', age: '...' }
  };

  return (
    <>
      <MsheetRenderer formData={myForm} ref={rendererRef} />
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
```

### With Pre-filled Data

```tsx
<MsheetRenderer
  formData={myForm}
  initialResponses={{
    name: 'John Doe',
    age: '42',
  }}
/>
```

### With YAML/JSON String

```tsx
const yamlSchema = `
schemaType: mieforms-v1.0
title: Simple Form
fields:
  - id: q1
    fieldType: text
    question: Your name?
`;

<MsheetRenderer formData={yamlSchema} />;
```

## API

### `<MsheetRenderer>`

**Props:**

- `formData: FormDefinition | string` - Form schema (object, JSON string, or YAML string)
- `initialResponses?: FormResponse` - Pre-fill form with initial data
- `className?: string` - Additional CSS classes for root container
- `ref?: Ref<MsheetRendererHandle>` - Access ref API for collecting responses

**Ref API:**

```tsx
interface MsheetRendererHandle {
  getResponse: () => FormResponse;
  getFormStore: () => FormStore;
  getUIStore: () => UIStore;
}
```

## Architecture

MsheetRenderer is a thin wrapper that:

1. Creates form and UI stores (vanilla Zustand)
2. Parses and validates input (YAML/JSON → Zod schema check)
3. Loads definition into store
4. Sets preview mode (read-only, no editing UI)
5. Iterates over visible fields via `RendererBody`
6. Renders each field via `FieldNode` (uses `@msheet/fields` components)

**Conditional Logic:**

- Reuses `form.isVisible()`, `form.isEnabled()`, `form.isRequired()` from core
- Sections auto-hide when all children are invisible
- Field visibility updates reactively when responses change

**Section Nesting:**

- `FieldNode` recursively renders section children
- Each depth level adds left border and padding
- Respects visibility rules at every level

## Example: Conditional Visibility

```tsx
const conditionalForm: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  title: 'Conditional Form',
  fields: [
    {
      id: 'hasAllergies',
      fieldType: 'boolean',
      question: 'Do you have any allergies?',
    },
    {
      id: 'allergyList',
      fieldType: 'longtext',
      question: 'Please list your allergies',
      visible: {
        conditions: [
          {
            conditionType: 'comparison',
            fieldId: 'hasAllergies',
            operator: '==',
            value: true,
          },
        ],
        logicalOperator: 'AND',
      },
    },
  ],
};

// "allergyList" only shows when "hasAllergies" is checked
<MsheetRenderer formData={conditionalForm} />;
```

## CSS Architecture

The renderer uses Tailwind CSS v4 with `ms:` prefix. CSS is compiled via `@tailwindcss/cli` and embedded into the JS bundle at build time — consumers never need to import a stylesheet. A scoped reset on `.msheet-renderer-root` prevents style leakage in either direction. Dark mode is supported via `.dark` class on the root.

## License

MIT

## Building

Run `nx build @msheet/renderer` to build the library.

## Running unit tests

Run `nx test @msheet/renderer` to execute the unit tests via [Vitest](https://vitest.dev/).
