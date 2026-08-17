---
sidebar_position: 5
---

# Exporting Form Definitions

Get the current form definition from the builder for saving, storing, or transmitting to a server.

## Choosing a serialization format

The builder's **Export** action produces `*.esheet.yaml` by default. Choose **eSheet JSON** in the export dialog when a downstream system needs JSON; that produces `*.esheet.json`.

Use YAML for committed form layouts. It produces reviewable diffs, supports comments, and keeps multi-line help text readable. Use JSON for API payloads and other machine-to-machine interchange. Both files contain the same `FormDefinition`, and existing `.esheet.json` layouts continue to import and render.

## Using the `onChange` Callback

The simplest way to export is via the `onChange` prop:

```tsx
function FormEditor() {
  const handleChange = (definition: FormDefinition) => {
    // Save to your backend, localStorage, etc.
    console.log(JSON.stringify(definition, null, 2));
  };

  return <EsheetBuilder definition={initialDef} onChange={handleChange} />;
}
```

The `onChange` callback fires on **every change** (field edits, reorder, add, remove). The provided `FormDefinition` is a **clean tree** -- no internal state, no response data.

## Export Format

The exported `FormDefinition` contains only structural data. The on-disk YAML form looks like this:

```yaml
id: my-form
title: My Form
description: Optional description
pages:
  - id: page-1
    fields:
      - id: q1
        fieldType: text
        question: Your name
        required: true
        inputType: string
```

For a wire/API payload, serialize the same object as JSON:

```ts
fetch('/api/forms', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(definition),
});
```

**What's included:**

- Form identifier (id)
- Form title and description
- All field definitions with their properties
- Conditional rules
- Section hierarchy (nested `fields`)

**What's NOT included:**

- User responses / answers
- Internal normalized state
- UI selection or mode state

## Hydration

Internally, the builder uses a **normalized flat state** for O(1) operations. When exporting, `hydrateDefinition()` converts this back to the nested tree structure expected by `FormDefinition`.

This happens automatically when using `onChange` -- you always receive a standard `FormDefinition`.

## Debouncing

The `onChange` callback fires on every keystroke and edit. For network-intensive operations (e.g., auto-saving to a server), consider debouncing:

```tsx
import { useMemo } from 'react';

function FormEditor() {
  const debouncedSave = useMemo(
    () =>
      debounce((def: FormDefinition) => {
        fetch('/api/forms', {
          method: 'PUT',
          body: JSON.stringify(def),
        });
      }, 500),
    []
  );

  return <EsheetBuilder definition={initialDef} onChange={debouncedSave} />;
}
```

## Programmatic Store Access

For advanced use cases, access the FormStore directly via React context:

```tsx
import { useFormStore } from '@esheet/builder';

function ExportButton() {
  const form = useFormStore();

  const handleExport = () => {
    const definition = form.getState().hydrateDefinition();
    // Use the definition...
  };

  return <button onClick={handleExport}>Export</button>;
}
```

:::warning
`useFormStore()` only works within the `EsheetBuilder` component tree where the FormStoreContext is provided.
:::
