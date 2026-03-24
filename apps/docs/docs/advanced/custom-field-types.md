---
sidebar_position: 1
---

# Custom Field Types

eSheet's field type system is extensible -- you can register your own custom field types that work seamlessly in both the builder and renderer.

## Overview 🧩

Custom field types are registered via the `registerCustomFieldTypes()` function from `@esheet/fields`. Each custom type needs:

1. **Metadata** -- label, category, answer type, default properties
2. **React component** -- implements the `FieldComponentProps` interface

## Registration API

```tsx
import { registerCustomFieldTypes } from '@esheet/fields';
import { MyCustomField } from './MyCustomField';

registerCustomFieldTypes({
  myCustomField: {
    label: 'My Custom Field',
    category: 'text',
    answerType: 'text',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {
      question: 'Custom question',
    },
    component: MyCustomField,
  },
});
```

### Metadata Properties

| Property | Type | Description |
|---|---|---|
| `label` | `string` | Human-readable label shown in the builder's ToolPanel |
| `category` | `FieldCategory` | Grouping in the ToolPanel (`'text'`, `'selection'`, `'rating'`, `'matrix'`, `'rich'`, `'organization'`) |
| `answerType` | `AnswerType` | How the field stores its answer (`'text'`, `'selection'`, `'multiselection'`, `'multitext'`, `'matrix'`, `'media'`, `'display'`, `'container'`, `'none'`) |
| `hasOptions` | `boolean` | Whether the field uses an options array |
| `hasMatrix` | `boolean` | Whether the field uses rows/columns |
| `defaultProps` | `Partial<FieldDefinition>` | Default property values for new fields |
| `placeholder` | `Record<string, string>` | Optional placeholder strings |
| `defaultOptionCount` | `number` | Number of starter options (if `hasOptions` is true) |

## FieldComponentProps

Every field component (built-in or custom) receives the same props interface:

```typescript
interface FieldComponentProps {
  /** The field node (definition + tree metadata) */
  field: FieldNode;
  /** The form store instance */
  form: FormStore;
  /** The UI store instance */
  ui: UIStore;
  /** Whether this field is selected in the builder */
  isSelected: boolean;
  /** Whether the host is in preview/render mode */
  isPreview: boolean;
  /** Computed conditional enabled state */
  isEnabled: boolean;
  /** Computed conditional required state */
  isRequired: boolean;
  /** Current response data for this field */
  response: FieldResponse | undefined;
  /** Remove this field from the form */
  onRemove: () => void;
  /** Patch this field's definition (except nested fields) */
  onUpdate: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => void;
  /** Set this field's response value */
  onResponse: (response: FieldResponse) => void;
}
```

## Example: Color Picker Field

```tsx
import type { FieldComponentProps } from '@esheet/core';

export function ColorPickerField({
  field,
  response,
  isPreview,
  isEnabled,
  onResponse,
}: FieldComponentProps) {
  const currentColor = response?.answer || '#000000';

  return (
    <div>
      <div>{field.definition.question}</div>
      <input
        type="color"
        value={currentColor}
        disabled={!isEnabled}
        onChange={(e) => onResponse({ answer: e.target.value })}
      />
      {isPreview && <span>Selected: {currentColor}</span>}
    </div>
  );
}
```

Register it:

```tsx
import { registerCustomFieldTypes } from '@esheet/fields';
import { ColorPickerField } from './ColorPickerField';

registerCustomFieldTypes({
  colorPicker: {
    label: 'Color Picker',
    category: 'text',
    answerType: 'text',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    component: ColorPickerField,
  },
});
```

The custom field will now appear in the builder's ToolPanel under the "Text" category and work in both the builder and renderer.

## Registry Functions

| Function | Description |
|---|---|
| `registerCustomFieldTypes(types)` | Register one or more custom field types |
| `getFieldComponent(fieldType)` | Get the React component for a field type |
| `registerFieldType(key, meta)` | Register metadata for a field type (core) |
| `getFieldTypeMeta(key)` | Get metadata for a registered field type |
| `getRegisteredFieldTypes()` | Get all registered field type keys |
