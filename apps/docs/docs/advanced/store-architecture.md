---
sidebar_position: 2
---

# Store Architecture

eSheet uses **Zustand vanilla stores** for state management. The core package (`@esheet/core`) provides two stores that are framework-agnostic, while React packages wrap them with context providers.

## Two Stores

### FormStore

The primary data store holding the form definition, normalized field index, and user responses.

**State:**
- `instanceId` -- unique instance identifier
- `normalized` -- flat field index (`{ byId, rootIds, childrenMap }`)
- `responses` -- `Record<fieldId, FieldResponse>`

**Key Actions:**

| Action | Description |
|---|---|
| `loadDefinition(def)` | Load a FormDefinition into normalized state |
| `setResponse(fieldId, response)` | Set a field's response value |
| `resetResponses()` | Clear all responses |
| `addField(fieldType, parentId?)` | Add a new field (builder) |
| `updateField(fieldId, patch)` | Update a field's definition (builder) |
| `removeField(fieldId)` | Remove a field (builder) |
| `moveField(fieldId, newIndex, newParentId?)` | Reorder a field (builder) |
| `addOption(fieldId)` / `updateOption()` / `removeOption()` | Manage field options (builder) |
| `addRow()` / `updateRow()` / `removeRow()` | Manage matrix rows (builder) |
| `addColumn()` / `updateColumn()` / `removeColumn()` | Manage matrix columns (builder) |

**Key Selectors:**

| Selector | Description |
|---|---|
| `getField(fieldId)` | Get a field's definition |
| `getResponse(fieldId)` | Get a field's response |
| `isVisible(fieldId)` | Check computed visibility |
| `isEnabled(fieldId)` | Check computed enabled state |
| `isRequired(fieldId)` | Check computed required state |
| `getFieldErrors(fieldId)` | Get validation errors for a field |
| `getErrors()` | Get all validation errors |
| `hydrateDefinition()` | Export as nested FormDefinition tree |
| `hydrateResponse()` | Export responses joined with questions |

## Normalized State

Manages UI state for the builder (mode, selection, tabs).

**State:**

| Property | Type | Description |
|---|---|---|
| `selectedFieldId` | `string \| null` | Currently selected field |
| `selectedFieldChildId` | `string \| null` | Selected child within a section |
| `mode` | `'build' \| 'code' \| 'preview'` | Current editor mode |
| `editTab` | `'edit' \| 'logic'` | Active tab in the EditPanel |
| `editModalOpen` | `boolean` | Whether the mobile edit drawer is open |
| `codeEditorHasError` | `boolean` | Whether the code editor has validation errors |

The FormStore uses a **normalized (flat) data structure** rather than nested trees:

```typescript
interface NormalizedState {
  byId: Record<string, FieldDefinition>;  // O(1) lookup by ID
  rootIds: string[];                       // Top-level field order
  childrenMap: Record<string, string[]>;   // parentId -> childIds
}
```

**Why normalized?**
- **O(1) field operations** -- add, update, remove, move are constant time
- **No deep cloning** -- editing a nested field doesn't copy the entire tree
- **Simple subscriptions** -- React components subscribe to specific field changes
- **Tree reconstruction** -- `hydrateDefinition()` rebuilds the nested tree for export

## React Integration

React packages consume the vanilla stores via context:

```tsx
// Provided by EsheetBuilder and EsheetRenderer
<FormStoreContext.Provider value={formStore}>
  <UIContext.Provider value={uiStore}>
    {children}
  </UIContext.Provider>
</FormStoreContext.Provider>
```

Hooks for accessing stores:

```tsx
import { useFormStore, useUI } from '@esheet/builder';
// or
import { useFormStore, useUI } from '@esheet/fields';

function MyComponent() {
  const form = useFormStore();  // FormStore instance
  const ui = useUI();           // UIStore instance

  // Read state with useSyncExternalStore
  const mode = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().mode
  );
}
```

## Creating Stores

For advanced use cases (testing, custom wrappers):

```tsx
import { createFormStore, createUIStore } from '@esheet/core';

const formStore = createFormStore(optionalDefinition);
const uiStore = createUIStore();
```
