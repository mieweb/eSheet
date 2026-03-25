---
sidebar_position: 20
---

# API Reference

Quick reference of all public exports from each eSheet package.

## @esheet/core

### Types

| Export                       | Kind       | Description                                                                           |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `FormDefinition`             | Interface  | Top-level form structure                                                              |
| `FieldDefinition`            | Interface  | Single field structure                                                                |
| `FieldResponse`              | Interface  | Response values for a field                                                           |
| `FormResponse`               | Type alias | `Record<string, FieldResponse>`                                                       |
| `SelectedOption`             | Interface  | `{ id, value }` for selected options                                                  |
| `FieldType`                  | Type       | Union of 19 field type strings                                                        |
| `TextInputType`              | Type       | Union of 9 text input variants                                                        |
| `FieldOption`                | Interface  | Option in a choice field                                                              |
| `MatrixRow` / `MatrixColumn` | Interface  | Matrix dimensions                                                                     |
| `ConditionalRule`            | Interface  | Conditional rule structure                                                            |
| `Condition`                  | Interface  | Single condition                                                                      |
| `ConditionOperator`          | Type       | Union of 10 operators                                                                 |
| `ConditionalEffect`          | Type       | `'visible' \| 'enable' \| 'required'`                                                 |
| `LogicMode`                  | Type       | `'AND' \| 'OR'`                                                                       |
| `FieldCategory`              | Type       | Field grouping category                                                               |
| `AnswerType`                 | Type       | How a field stores its answer                                                         |
| `FieldTypeMeta`              | Interface  | Field type metadata                                                                   |
| `FieldTypeRegistry`          | Type       | Registry map                                                                          |
| `FieldComponentProps`        | Interface  | Props contract for field components                                                   |
| `HydratedResponseItem`       | Interface  | `{ id, text, answer }` — one per answerable field, returned by `hydrateResponse`      |
| `FieldNode`                  | Interface  | Node in normalized definition tree                                                    |
| `NormalizedDefinition`       | Interface  | Flat normalized representation of a form                                              |
| `SheetDndDropDetail`         | Interface  | Custom event detail for `sheetdrop` events: `{ sourceId, targetId, edge, operation }` |
| `AddFieldOptions`            | Interface  | Options for `FormStore.addField()`                                                    |

### Constants

| Export                | Description                        |
| --------------------- | ---------------------------------- |
| `SCHEMA_TYPE`         | `'mieforms-v1.0'`                  |
| `FIELD_TYPES`         | Array of 19 field type strings     |
| `TEXT_INPUT_TYPES`    | Array of 9 text input type strings |
| `CONDITION_OPERATORS` | Array of 10 operator strings       |
| `CONDITIONAL_EFFECTS` | Array of 3 effect strings          |

### Zod Schemas

| Export                     | Validates                         |
| -------------------------- | --------------------------------- |
| `formDefinitionSchema`     | `FormDefinition`                  |
| `fieldDefinitionSchema`    | `FieldDefinition`                 |
| `fieldTypeSchema`          | `FieldType`                       |
| `conditionSchema`          | `Condition`                       |
| `conditionalRuleSchema`    | `ConditionalRule`                 |
| `formDefinitionJSONSchema` | JSON Schema (Draft-07) for Monaco |

### Store Factories

| Export                  | Returns     | Description                   |
| ----------------------- | ----------- | ----------------------------- |
| `createFormStore(def?)` | `FormStore` | Create a new form state store |
| `createUIStore()`       | `UIStore`   | Create a new UI state store   |

### Logic & Validation

| Export                                                  | Description                   |
| ------------------------------------------------------- | ----------------------------- |
| `evaluateRule(rule, normalized, responses)`             | Evaluate a conditional rule   |
| `evaluateCondition(condition, definition, response)`    | Evaluate a single condition   |
| `evaluateExpression(expression, normalized, responses)` | Evaluate an expression string |
| `isExpressionValid(expr)`                               | Validate expression syntax    |
| `resolveEffect(effect, field, normalized, responses)`   | Resolve a conditional effect  |
| `validateField(fieldId, normalized, responses)`         | Validate a single field       |
| `validateForm(normalized, responses)`                   | Validate all fields           |

### Utilities

| Export                                                    | Description                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `normalizeDefinition(def)`                                | Convert tree → flat normalized state                                                 |
| `hydrateDefinition(normalized)`                           | Convert flat → nested tree                                                           |
| `hydrateResponse(normalized, responses)`                  | Walk normalized definition and return `HydratedResponseItem[]` for export/submission |
| `generateFieldId(fieldType)`                              | Generate a unique field ID                                                           |
| `generateOptionId()`                                      | Generate a unique option ID                                                          |
| `generateRowId()`                                         | Generate a unique matrix row ID                                                      |
| `generateColumnId()`                                      | Generate a unique matrix column ID                                                   |
| `applySheetDnd(handle)`                                   | Attach pointer-event drag-and-drop to a drag handle element                          |
| `getReorderDestinationIndex(source, target, edge, items)` | Calculate the destination index after a reorder drop                                 |

### Registry

| Export                            | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `registerFieldType(key, meta)`    | Register a field type                             |
| `registerFieldElements(elements)` | Batch-register UI element classes for field types |
| `getFieldTypeMeta(key)`           | Get field type metadata                           |
| `getRegisteredFieldTypes()`       | List all registered types                         |
| `resetFieldTypeRegistry()`        | Reset to built-in types                           |

---

## @esheet/fields

### Components

All 19 field components: `TextField`, `LongTextField`, `MultiTextField`, `RadioField`, `CheckField`, `BooleanField`, `DropdownField`, `MultiSelectDropdownField`, `RatingField`, `RankingField`, `SliderField`, `SingleMatrixField`, `MultiMatrixField`, `SectionField`, `DisplayField`, `HtmlField`, `ImageField`, `SignatureField`, `DiagramField`

### Custom Controls

| Export           | Description                               |
| ---------------- | ----------------------------------------- |
| `CustomRadio`    | Styled radio with `onSelect`/`onUnselect` |
| `CustomCheckbox` | Styled checkbox                           |
| `CustomDropdown` | Styled dropdown                           |
| `DrawingPad`     | Canvas drawing component                  |

### Drawing Types

| Export              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `DrawingData`       | Drawing canvas data structure                           |
| `DrawingPadConfig`  | Configuration options for `DrawingPad`                  |
| `DrawingPadPayload` | Payload emitted by `DrawingPad` on change               |
| `NormalizedPoint`   | `{ x, y }` coordinate normalized to canvas size         |
| `Stroke`            | Single stroke in a drawing (array of `NormalizedPoint`) |

### Icons

| Export            | Description                  |
| ----------------- | ---------------------------- |
| `TrashIcon`       | Trash / delete icon          |
| `PlusIcon`        | Plus / add icon              |
| `ArrowUpIcon`     | Arrow up icon                |
| `ArrowDownIcon`   | Arrow down icon              |
| `UpDownArrowIcon` | Up-down (reorder) arrow icon |

### Registry

| Export                            | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `registerCustomFieldTypes(types)` | Register custom field types with components       |
| `registerFieldComponents(map)`    | Register a map of field type -> React component   |
| `getFieldComponent(fieldType)`    | Get the React component for a field type          |
| `getRegisteredComponentKeys()`    | List all registered field component keys          |
| `resetComponentRegistry()`        | Reset the component registry to built-in defaults |

### Context

| Export             | Description                 |
| ------------------ | --------------------------- |
| `FormStoreContext` | React context for FormStore |
| `UIContext`        | React context for UIStore   |
| `useFormStore()`   | Hook to access FormStore    |
| `useUI()`          | Hook to access UIStore      |

---

## @esheet/builder

### Components

| Export          | Description                         |
| --------------- | ----------------------------------- |
| `EsheetBuilder` | Main builder component              |
| `BuilderHeader` | Mode switcher header (advanced)     |
| `CodeView`      | JSON/YAML editor (advanced)         |
| `FieldWrapper`  | Selection chrome wrapper (advanced) |

### Hooks & Context

| Export              | Description                   |
| ------------------- | ----------------------------- |
| `useFormStore()`    | Access FormStore from context |
| `useUI()`           | Access UIStore from context   |
| `useInstanceId()`   | Get unique instance ID        |
| `FormStoreContext`  | FormStore React context       |
| `UIContext`         | UIStore React context         |
| `InstanceIdContext` | Instance ID React context     |

### Types

| Export                    | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `EsheetBuilderProps`      | Builder component props                        |
| `CodeViewProps`           | Props for `CodeView`                           |
| `FieldWrapperProps`       | Props for `FieldWrapper`                       |
| `FieldWrapperRenderProps` | Render props passed to `FieldWrapper` children |

---

## @esheet/renderer

### Components

| Export           | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `EsheetRenderer` | Main renderer component (forwardRef)                       |
| `RendererBody`   | Inner renderer body (advanced)                             |
| `FieldNode`      | Renders a single field node inside the renderer (advanced) |

### Hooks

| Export              | Description                                   |
| ------------------- | --------------------------------------------- |
| `useRendererInit()` | Initialize renderer with form data (advanced) |

### Types

| Export                 | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `EsheetRendererProps`  | Renderer component props                                      |
| `EsheetRendererHandle` | Ref handle type (`getResponse`, `getFormStore`, `getUIStore`) |
