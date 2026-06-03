---
sidebar_position: 1
---

# Builder Overview

The `EsheetBuilder` component provides a full visual form editor with drag-and-drop, property editing, conditional logic rules, and code editing.

## Layout

### Desktop (lg and above)

Three-column layout:

```
+----------+---------------------+--------------+
| ToolPanel|      Canvas         |  EditPanel   |
|          |                     |              |
| (field   |  (drag-and-drop     |  (edit tab   |
|  types   |   field list)       |   + logic    |
|  to add) |                     |   tab)       |
|          |                     |              |
+----------+---------------------+--------------+
```

### Mobile / Tablet

Single-column with bottom-sheet drawers:

- **Canvas** fills the screen
- **"Add Field" button** opens the ToolPanel in a bottom drawer
- **Tapping a field** opens the EditPanel in a bottom drawer

## Three Modes

The builder header provides mode switching:

| Mode        | Description                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Build**   | Visual editor -- drag-and-drop canvas with ToolPanel and EditPanel                                                                  |
| **Code**    | JSON/YAML editor (Monaco) -- edit the form definition as text                                                                       |
| **Preview** | Read-only preview -- same rendering as the Renderer component. Includes a **Touch Mode** toggle for testing mobile-friendly sizing. |

## Component API

```tsx
import { EsheetBuilder } from '@esheet/builder';

<EsheetBuilder
  definition={myFormDef} // Initial FormDefinition
  onChange={(def) => save(def)} // Called on every change
  dragEnabled={true} // Drag-and-drop (default: true)
  className="my-builder" // Additional CSS class
>
  {/* Optional children below the header */}
</EsheetBuilder>;
```

### Props Reference

| Prop                | Type                            | Default     | Description                                                                                                                                                             |
| ------------------- | ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `definition`        | `FormDefinition`                | `undefined` | Initial form definition — accepts eSheet `FormDefinition`, FHIR R4 Questionnaire, SurveyJS schema, or MCP elicitation envelope. Auto-detected and converted internally. |
| `onChange`          | `(def: FormDefinition) => void` | --          | Called when the form definition changes (any edit, reorder, add, remove)                                                                                                |
| `dragEnabled`       | `boolean`                       | `true`      | Whether drag-and-drop reordering is enabled. When `false`, field reordering is disabled entirely — there is no fallback UI (e.g. arrow buttons).                        |
| `className`         | `string`                        | `''`        | Additional CSS class for the root container                                                                                                                             |
| `touchMode`         | `boolean \| 'auto'`             | --          | Touch mode for preview: `true`, `false`, `'auto'`, or omit for CSS-only                                                                                                 |
| `onTouchModeChange` | `(enabled: boolean) => void`    | --          | Callback when touch mode changes                                                                                                                                        |
| `children`          | `ReactNode`                     | --          | Content rendered between the header and the editor layout                                                                                                               |

See [Touch Mode](./touch-mode) for details on mobile-friendly form preview.

## Exported Hooks & Contexts

The builder re-exports these from `@esheet/fields` for advanced use:

| Export              | Type    | Description                                     |
| ------------------- | ------- | ----------------------------------------------- |
| `useFormStore()`    | Hook    | Access the FormStore from React context         |
| `useUI()`           | Hook    | Access the UIStore from React context           |
| `useInstanceId()`   | Hook    | Get the unique per-instance ID for DOM elements |
| `FormStoreContext`  | Context | React context providing the FormStore           |
| `UIContext`         | Context | React context providing the UIStore             |
| `InstanceIdContext` | Context | React context providing the instance ID string  |
