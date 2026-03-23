# @esheet/builder

Drag-and-drop questionnaire builder for eSheet. Provides a full editing UI for creating and modifying form schemas.

## Features

- ✅ Visual form builder with drag & drop (custom pointer-based engine)
- ✅ 19 built-in field types via `@esheet/fields`
- ✅ Section nesting with drag-into-section support
- ✅ Field editors (question text, options, matrix rows/columns, conditional logic)
- ✅ Code view with Monaco editor (JSON/YAML toggle)
- ✅ Live preview mode
- ✅ Import/Export (JSON + YAML)
- ✅ Custom field type registration
- ✅ Dark mode support
- ✅ Mobile responsive (bottom drawer for panels)
- ✅ Self-contained CSS (injected at runtime, no external stylesheet needed)

## Installation

```bash
npm install @esheet/builder @esheet/fields @esheet/core
```

## Usage

### Basic Example

```tsx
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';

function App() {
  const handleChange = (definition: FormDefinition) => {
    console.log('Form updated:', definition);
  };

  return <EsheetBuilder onChange={handleChange} />;
}
```

### With Initial Schema

```tsx
import { EsheetBuilder } from '@esheet/builder';

const initialForm: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  title: 'Patient Intake',
  fields: [
    { id: 'name', fieldType: 'text', question: 'Full Name', required: true },
    { id: 'dob', fieldType: 'date', question: 'Date of Birth' },
  ],
};

<EsheetBuilder initialDefinition={initialForm} onChange={handleChange} />;
```

### Dark Mode

```tsx
<div className="dark">
  <EsheetBuilder onChange={handleChange} />
</div>
```

Add the `dark` class to the builder's root or any ancestor — the builder scopes all dark styles via `.es-builder-root.dark`.

## API

### `<EsheetBuilder>`

**Props:**

| Prop                | Type                            | Description                     |
| ------------------- | ------------------------------- | ------------------------------- |
| `initialDefinition` | `FormDefinition`                | Pre-load a form schema          |
| `onChange`          | `(def: FormDefinition) => void` | Callback on any form change     |
| `className`         | `string`                        | Additional CSS classes for root |

## Custom Field Types

```tsx
import { EsheetBuilder } from '@esheet/builder';
import { registerCustomFieldTypes } from '@esheet/fields';
import { registerFieldType } from '@esheet/core';

// Register the metadata
registerFieldType({
  type: 'nps',
  label: 'NPS Score',
  category: 'scale',
  defaultProps: { question: 'How likely are you to recommend us?' },
});

// Register the component
registerCustomFieldTypes({
  nps: {
    component: NpsField,
    meta: {
      /* ... */
    },
  },
});

<EsheetBuilder onChange={handleChange} />;
```

## CSS Architecture

The builder uses Tailwind CSS v4 with `es:` prefix. CSS is compiled via `@tailwindcss/cli` and embedded into the JS bundle at build time — consumers never need to import a stylesheet. A scoped reset on `.es-builder-root` prevents style leakage in either direction.

## Building

Run `nx build @esheet/builder` to build the library.

## Running unit tests

Run `nx test @esheet/builder` to execute the unit tests via [Vitest](https://vitest.dev/).
