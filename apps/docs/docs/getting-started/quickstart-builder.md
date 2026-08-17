---
sidebar_position: 2
---

# Quick Start: Builder

Add a visual form editor to your React application in minutes.

This quick start covers React integration. For non-React mounting or Blaze, see the [Installation guide](./installation).

> The example below imports `FormDefinition` from `@esheet/core`. If your app uses core types directly, add `@esheet/core` as an explicit dependency.

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

The builder receives a parsed `FormDefinition`, so parse the canonical YAML source before passing it to the component. Install `js-yaml` in the host application with `npm install js-yaml`.

```tsx
import { load } from 'js-yaml';
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';

// In a real app, load this from patient-intake.esheet.yaml.
const initialForm = load(`
id: patient-intake
title: Patient Intake
description: Basic patient information form
pages:
  - id: patient-information
    fields:
      - id: name
        fieldType: text
        question: Full Name
        required: true
        inputType: string
      - id: email
        fieldType: text
        question: Email Address
        inputType: email
      - id: reason
        fieldType: radio
        question: Reason for Visit
        options:
          - id: opt1
            value: Check-up
          - id: opt2
            value: Follow-up
          - id: opt3
            value: New concern
`) as FormDefinition;

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

| Prop                  | Type                            | Default     | Description                                              |
| --------------------- | ------------------------------- | ----------- | -------------------------------------------------------- |
| `definition`          | `FormDefinition`                | `undefined` | Initial form definition to load                          |
| `onChange`            | `(def: FormDefinition) => void` | --          | Called when the form changes                             |
| `dragEnabled`         | `boolean`                       | `true`      | Enable drag-and-drop reordering                          |
| `allowDangerousJS`    | `boolean`                       | `false`     | Allow JS calculations and `conditionType: 'js'` in forms |
| `touchMode`           | `boolean \| 'auto'`             | --          | Touch mode: `true`, `false`, `'auto'`, or omit for CSS   |
| `onTouchModeChange`   | `(enabled: boolean) => void`    | --          | Callback when touch mode changes                         |
| `className`           | `string`                        | `''`        | Additional CSS class                                     |
| `children`            | `ReactNode`                     | --          | Content rendered below the header                        |
| `onBuilderToolsReady` | `(handler) => void`             | --          | Called with MCP tool handler when ready                  |

## Builder Modes

The builder has three modes accessible via the header tabs:

1. **Build** -- Visual drag-and-drop editor (default)
2. **Code** -- YAML-first JSON/YAML editor with syntax highlighting (Monaco)
3. **Preview** -- Read-only form preview (same rendering as the Renderer)

## What's Next

- [Canvas & Drag-and-Drop](../builder/canvas) -- Learn about the visual editor
- [Field Editing](../builder/editing) -- Customize field properties and logic
- [Code View](../builder/code-view) -- Edit form definitions as YAML (or JSON)
- [Exporting](../builder/exporting) -- Get the form definition for saving
