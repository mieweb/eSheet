# @esheet/builder

Drag-and-drop questionnaire builder for eSheet. Provides a full editing UI for creating and modifying form schemas.

## Features

- ✅ Visual form builder with drag & drop (custom pointer-based engine)
- ✅ 19 built-in field types via `@esheet/fields`
- ✅ Section nesting with drag-into-section support
- ✅ Field editors (question text, options, matrix rows/columns, conditional logic)
- ✅ Code view with Monaco editor (YAML default, JSON toggle)
- ✅ Live preview mode
- ✅ Import/Export (YAML default, JSON option)
- ✅ Custom field type registration
- ✅ Dark mode support
- ✅ Mobile responsive (bottom drawer for panels)
- ✅ Self-contained CSS (injected at runtime, no external stylesheet needed)

## Installation

```bash
npm install @esheet/builder @esheet/fields @esheet/core js-yaml
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
import { load } from 'js-yaml';
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';

const initialForm = load(`
id: patient-intake
title: Patient Intake
pages:
  - id: patient-information
    fields:
      - id: name
        fieldType: text
        question: Full Name
        required: true
      - id: dob
        fieldType: text
        question: Date of Birth
        inputType: date
`) as FormDefinition;

<EsheetBuilder definition={initialForm} onChange={handleChange} />;
```

### Dark Mode

```tsx
<div className="dark">
  <EsheetBuilder onChange={handleChange} />
</div>
```

Add the `dark` class to the builder's root or any ancestor — the builder scopes all dark styles via `.ms-builder-root.dark`.

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

The builder uses Tailwind CSS v4 with an `ms:` prefix. `@esheet/styles` compiles the shared builder, renderer, and fields utility set and loads it automatically, so consumers do not need to import an eSheet stylesheet. Applications using `@mieweb/ui` components must still load `@mieweb/ui/styles.css` and select a brand stylesheet.

## Building

Run `pnpm --filter @esheet/builder build` to build the library.

## Running unit tests

Run `pnpm --filter @esheet/builder test` to execute the unit tests via [Vitest](https://vitest.dev/).
