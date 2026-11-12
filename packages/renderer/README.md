# @esheet/renderer

Read-only questionnaire form renderer for eSheet. Renders forms in fill-out mode with conditional visibility logic.

## Features

- ✅ Renders all 19 eSheet field types (reuses `@esheet/fields` components)
- ✅ Conditional visibility enforcement (fields/sections hide based on logic rules)
- ✅ Section nesting with recursive rendering
- ✅ Initial response pre-fill support
- ✅ YAML-first JSON/YAML schema parsing with Zod validation
- ✅ Ref API for collecting responses
- ✅ TypeScript-first with full type safety

## Installation

```bash
npm install @esheet/renderer @esheet/fields @esheet/core
```

Standalone and Blaze integrations now ship as separate packages:

```bash
npm install @esheet/renderer-standalone
npm install @esheet/renderer-blaze
```

Migration for old subpath imports:

- `@esheet/renderer/standalone` -> `@esheet/renderer-standalone`
- `@esheet/renderer/blaze` -> `@esheet/renderer-blaze`

## Usage

Committed form definitions should use YAML (`*.esheet.yaml`); JSON remains supported for API and other wire-format payloads. The renderer accepts either format and auto-detects string input.

### Basic Example

```tsx
import { EsheetRenderer } from '@esheet/renderer';

const myForm = `
id: patient-intake
title: Patient Intake
pages:
  - id: patient-information
    fields:
      - id: name
        fieldType: text
        question: Full Name
        required: true
      - id: age
        fieldType: text
        question: Age
`;

function App() {
  return (
    <div className="app-container">
      <EsheetRenderer formDataInput={myForm} />
    </div>
  );
}
```

### With Response Collection

```tsx
import { useRef } from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';

function App() {
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const handleSubmit = () => {
    const responses = rendererRef.current?.getResponse();
    console.log('Form responses:', responses);
    // { name: '...', age: '...' }
  };

  return (
    <>
      <EsheetRenderer formDataInput={myForm} ref={rendererRef} />
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
```

### With Pre-filled Data

```tsx
<EsheetRenderer
  formDataInput={myForm}
  initialResponses={{
    name: 'John Doe',
    age: '42',
  }}
/>
```

### With YAML/JSON String

```tsx
const yamlDefinition = `
id: simple-form
title: Simple Form
pages:
  - id: page-1
    fields:
      - id: q1
        fieldType: text
        question: Your name?
`;

<EsheetRenderer formDataInput={yamlDefinition} />;

// JSON is also accepted for wire/API interchange.
<EsheetRenderer formDataInput='{"id":"simple-form","pages":[]}' />;
```

## API

### `<EsheetRenderer>`

**Props:**

- `formDataInput: FormDefinition | string` - Form schema (object, YAML string, or JSON string)
- `initialResponses?: FormResponse` - Pre-fill form with initial data
- `className?: string` - Additional CSS classes for root container
- `ref?: Ref<EsheetRendererHandle>` - Access ref API for collecting responses

**Ref API:**

```tsx
interface EsheetRendererHandle {
  getResponse: () => FormResponse;
  getFormStore: () => FormStore;
  getUIStore: () => UIStore;
}
```

## Architecture

EsheetRenderer is a thin wrapper that:

1. Creates form and UI stores (vanilla Zustand)
2. Parses and validates input (YAML/JSON → Zod schema check; YAML is the committed-layout default)
3. Loads definition into store
4. Sets preview mode (read-only, no editing UI)
5. Iterates over visible fields via `RendererBody`
6. Renders each field via `FieldNode` (uses `@esheet/fields` components)

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
const conditionalForm = `
id: conditional-form
title: Conditional Form
pages:
  - id: patient-information
    fields:
      - id: hasAllergies
        fieldType: boolean
        question: Do you have any allergies?
      - id: allergyList
        fieldType: longtext
        question: Please list your allergies
        rules:
          - effect: visible
            logic: AND
            conditions:
              - conditionType: field
                targetId: hasAllergies
                operator: equals
                expected: 'Yes'
`;

// "allergyList" only shows when "hasAllergies" is checked
<EsheetRenderer formDataInput={conditionalForm} />;
```

## CSS Architecture

The renderer uses Tailwind CSS v4 with an `ms:` prefix. `@esheet/styles` compiles the shared builder, renderer, and fields utility set and loads it automatically, so consumers do not need to import an eSheet stylesheet. Applications using `@mieweb/ui` components must still load `@mieweb/ui/styles.css` and select a brand stylesheet. Dark mode is supported via a `.dark` class on the root.

## License

MIT

## Building

Run `pnpm --filter @esheet/renderer build` to build the library.

## Running unit tests

Run `pnpm --filter @esheet/renderer test` to execute the unit tests via [Vitest](https://vitest.dev/).
