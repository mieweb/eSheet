# @msheet/builder

Drag-and-drop questionnaire builder for mSheet. Provides a full editing UI for creating and modifying form schemas.

## Features

- ✅ Visual form builder with drag & drop (custom pointer-based engine)
- ✅ 19 built-in field types via `@msheet/fields`
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
npm install @msheet/builder @msheet/fields @msheet/core
```

## Usage

### Basic Example

```tsx
import { MsheetBuilder } from '@msheet/builder';
import type { FormDefinition } from '@msheet/core';

function App() {
  const handleChange = (definition: FormDefinition) => {
    console.log('Form updated:', definition);
  };

  return <MsheetBuilder onChange={handleChange} />;
}
```

### With Initial Schema

```tsx
import { MsheetBuilder } from '@msheet/builder';

const initialForm: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  title: 'Patient Intake',
  fields: [
    { id: 'name', fieldType: 'text', question: 'Full Name', required: true },
    { id: 'dob', fieldType: 'date', question: 'Date of Birth' },
  ],
};

<MsheetBuilder initialDefinition={initialForm} onChange={handleChange} />;
```

### Dark Mode

```tsx
<div className="dark">
  <MsheetBuilder onChange={handleChange} />
</div>
```

Add the `dark` class to the builder's root or any ancestor — the builder scopes all dark styles via `.ms-builder-root.dark`.

## API

### `<MsheetBuilder>`

**Props:**

| Prop                | Type                            | Description                     |
| ------------------- | ------------------------------- | ------------------------------- |
| `initialDefinition` | `FormDefinition`                | Pre-load a form schema          |
| `onChange`          | `(def: FormDefinition) => void` | Callback on any form change     |
| `className`         | `string`                        | Additional CSS classes for root |

## Custom Field Types

```tsx
import { MsheetBuilder } from '@msheet/builder';
import { registerCustomFieldTypes } from '@msheet/fields';
import { registerFieldType } from '@msheet/core';

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

<MsheetBuilder onChange={handleChange} />;
```

## CSS Architecture

The builder uses Tailwind CSS v4 with `ms:` prefix. CSS is compiled via `@tailwindcss/cli` and embedded into the JS bundle at build time — consumers never need to import a stylesheet. A scoped reset on `.ms-builder-root` prevents style leakage in either direction.

## Building

Run `nx build @msheet/builder` to build the library.

## Running unit tests

Run `nx test @msheet/builder` to execute the unit tests via [Vitest](https://vitest.dev/).
