---
sidebar_position: 2
---

# Quick Start: Builder

Add a visual form editor to your React application in minutes.

## Basic Example

```tsx
import { useState } from 'react';
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';

function App() {
  const [formDef, setFormDef] = useState<FormDefinition | undefined>();

  return (
    <div style={{ height: '100vh' }}>
      <EsheetBuilder
        definition={formDef}
        onChange={(updated) => setFormDef(updated)}
      />
    </div>
  );
}
```

:::tip
The builder needs a container with explicit height. It fills its parent using `height: 100%` and flexbox.
:::

## With Initial Definition

Pre-populate the builder with an existing form:

```tsx
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';

const initialForm: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  title: 'Patient Intake',
  description: 'Basic patient information form',
  fields: [
    {
      id: 'name',
      fieldType: 'text',
      question: 'Full Name',
      required: true,
      inputType: 'string',
    },
    {
      id: 'email',
      fieldType: 'text',
      question: 'Email Address',
      inputType: 'email',
    },
    {
      id: 'reason',
      fieldType: 'radio',
      question: 'Reason for Visit',
      options: [
        { id: 'opt1', value: 'Check-up' },
        { id: 'opt2', value: 'Follow-up' },
        { id: 'opt3', value: 'New concern' },
      ],
    },
  ],
};

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <EsheetBuilder
        definition={initialForm}
        onChange={(def) => console.log('Form updated:', def)}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `definition` | `FormDefinition` | `undefined` | Initial form definition to load |
| `onChange` | `(def: FormDefinition) => void` | -- | Called when the form changes |
| `dragEnabled` | `boolean` | `true` | Enable drag-and-drop reordering |
| `className` | `string` | `''` | Additional CSS class |
| `children` | `ReactNode` | -- | Content rendered below the header |

## Builder Modes

The builder has three modes accessible via the header tabs:

1. **Build** -- Visual drag-and-drop editor (default)
2. **Code** -- JSON/YAML editor with syntax highlighting (Monaco)
3. **Preview** -- Read-only form preview (same rendering as the Renderer)

## What's Next

- [Canvas & Drag-and-Drop](../builder/canvas) -- Learn about the visual editor
- [Field Editing](../builder/editing) -- Customize field properties and logic
- [Code View](../builder/code-view) -- Edit form definitions as JSON/YAML
- [Exporting](../builder/exporting) -- Get the form definition for saving
