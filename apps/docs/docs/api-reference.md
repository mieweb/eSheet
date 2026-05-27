---
sidebar_position: 20
---

# API Reference

Quick reference of all public exports from each eSheet package.

## @esheet/core

### Types

| Export                               | Kind       | Description                                                                      |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| `FormDefinition`                     | Interface  | Top-level form structure                                                         |
| `FieldDefinition`                    | Interface  | Single field structure                                                           |
| `FieldResponse`                      | Interface  | Response values for a field                                                      |
| `FormResponse`                       | Type alias | `Record<string, FieldResponse>`                                                  |
| `SelectedOption`                     | Interface  | `{ id, value }` for selected options                                             |
| `FieldType`                          | Type       | Union of 19 field type strings                                                   |
| `TextInputType`                      | Type       | Union of 9 text input variants                                                   |
| `FieldOption`                        | Interface  | Option in a choice field                                                         |
| `MatrixRow` / `MatrixColumn`         | Interface  | Matrix dimensions                                                                |
| `ConditionalRule`                    | Interface  | Conditional rule structure                                                       |
| `Condition`                          | Interface  | Single condition                                                                 |
| `ConditionOperator`                  | Type       | Union of 10 operators                                                            |
| `ConditionalEffect`                  | Type       | `'visible' \| 'enable' \| 'required'`                                            |
| `LogicMode`                          | Type       | `'AND' \| 'OR'`                                                                  |
| `FieldCategory`                      | Type       | Field grouping category                                                          |
| `AnswerType`                         | Type       | How a field stores its answer                                                    |
| `FieldTypeMeta`                      | Interface  | Field type metadata                                                              |
| `FieldTypeRegistry`                  | Type       | Registry map                                                                     |
| `FieldComponentProps`                | Interface  | Props contract for field components                                              |
| `ResponseItem`                       | Interface  | `{ id, text, answer }` — one per answerable field, returned by `hydrateResponse` |
| `FieldNode`                          | Interface  | Node in normalized definition tree                                               |
| `OptionBearingFieldDefinition`       | Type       | Union of field definitions that have `options`                                   |
| `NormalizedDefinition`               | Interface  | Flat normalized representation of a form                                         |
| `AddFieldOptions`                    | Interface  | Options for `FormStore.addField()`                                               |
| `TextFieldDefinition`                | Interface  | Definition for text fields                                                       |
| `LongtextFieldDefinition`            | Interface  | Definition for longtext fields                                                   |
| `MultitextFieldDefinition`           | Interface  | Definition for multitext fields                                                  |
| `RadioFieldDefinition`               | Interface  | Definition for radio fields                                                      |
| `CheckFieldDefinition`               | Interface  | Definition for check fields                                                      |
| `BooleanFieldDefinition`             | Interface  | Definition for boolean fields                                                    |
| `DropdownFieldDefinition`            | Interface  | Definition for dropdown fields                                                   |
| `MultiselectDropdownFieldDefinition` | Interface  | Definition for multiselect dropdown fields                                       |
| `RatingFieldDefinition`              | Interface  | Definition for rating fields                                                     |
| `RankingFieldDefinition`             | Interface  | Definition for ranking fields                                                    |
| `SliderFieldDefinition`              | Interface  | Definition for slider fields                                                     |
| `SingleMatrixFieldDefinition`        | Interface  | Definition for single-select matrix fields                                       |
| `MultiMatrixFieldDefinition`         | Interface  | Definition for multi-select matrix fields                                        |
| `ImageFieldDefinition`               | Interface  | Definition for image fields                                                      |
| `HtmlFieldDefinition`                | Interface  | Definition for HTML fields                                                       |
| `SignatureFieldDefinition`           | Interface  | Definition for signature fields                                                  |
| `DiagramFieldDefinition`             | Interface  | Definition for diagram fields                                                    |
| `DisplayFieldDefinition`             | Interface  | Definition for display fields                                                    |
| `SectionFieldDefinition`             | Interface  | Definition for section fields                                                    |

### Type Predicates

| Export       | Description                                       |
| ------------ | ------------------------------------------------- |
| `hasOptions` | Type predicate for fields with `options` property |

### Constants

| Export                | Description                        |
| --------------------- | ---------------------------------- |
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

| Export                                   | Description                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `normalizeDefinition(def)`               | Convert tree → flat normalized state                                         |
| `hydrateDefinition(normalized)`          | Convert flat → nested tree                                                   |
| `hydrateResponse(normalized, responses)` | Walk normalized definition and return `ResponseItem[]` for export/submission |
| `generateFieldId(fieldType)`             | Generate a unique field ID                                                   |
| `generateOptionId()`                     | Generate a unique option ID                                                  |
| `generateRowId()`                        | Generate a unique matrix row ID                                              |
| `generateColumnId()`                     | Generate a unique matrix column ID                                           |
| `formatZodValidationError(error)`        | Format Zod validation errors into readable strings                           |

### Registry

| Export                            | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `registerFieldType(key, meta)`    | Register a field type                             |
| `registerFieldElements(elements)` | Batch-register UI element classes for field types |
| `getFieldTypeMeta(key)`           | Get field type metadata                           |
| `getRegisteredFieldTypes()`       | List all registered types                         |

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

| Export                            | Description                                     |
| --------------------------------- | ----------------------------------------------- |
| `registerCustomFieldTypes(types)` | Register custom field types with components     |
| `registerFieldComponents(map)`    | Register a map of field type -> React component |
| `getFieldComponent(fieldType)`    | Get the React component for a field type        |
| `getRegisteredComponentKeys()`    | List all registered field component keys        |

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

| Export                | Description                           |
| --------------------- | ------------------------------------- |
| `useFormStore()`      | Access FormStore from context         |
| `useUI()`             | Access UIStore from context           |
| `useInstanceId()`     | Get unique instance ID                |
| `FormStoreContext`    | FormStore React context               |
| `UIContext`           | UIStore React context                 |
| `InstanceIdContext`   | Instance ID React context             |
| `useFormApi()`        | Hook returning imperative form API    |
| `useUiApi()`          | Hook returning imperative UI API      |
| `useVisibleRootIds()` | Hook returning visible root field IDs |

### MCP Integration

| Export                     | Description                               |
| -------------------------- | ----------------------------------------- |
| `executeToolCall`          | Execute a builder tool call               |
| `BUILDER_TOOL_DEFINITIONS` | Array of MCP tool definitions for builder |
| `BUILDER_SYSTEM_PROMPT`    | System prompt describing builder tools    |
| `useBuilderMcpToolHandler` | Hook for handling MCP tool calls in React |

### Types

| Export                            | Description                                    |
| --------------------------------- | ---------------------------------------------- |
| `EsheetBuilderProps`              | Builder component props                        |
| `CodeViewProps`                   | Props for `CodeView`                           |
| `FieldWrapperProps`               | Props for `FieldWrapper`                       |
| `FieldWrapperRenderProps`         | Render props passed to `FieldWrapper` children |
| `FormApi`                         | Imperative form API interface                  |
| `FieldResponseMap`                | Map of field IDs to responses                  |
| `UiApi`                           | Imperative UI API interface                    |
| `ToolDefinition`                  | MCP tool definition type                       |
| `UseBuilderMcpToolHandlerOptions` | Options for `useBuilderMcpToolHandler`         |

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

### MCP Integration

| Export                      | Description                                |
| --------------------------- | ------------------------------------------ |
| `executeToolCall`           | Execute a renderer tool call               |
| `RENDERER_TOOL_DEFINITIONS` | Array of MCP tool definitions for renderer |
| `RENDERER_SYSTEM_PROMPT`    | System prompt describing renderer tools    |
| `useRendererMcpToolHandler` | Hook for handling MCP tool calls in React  |

### Types

| Export                             | Description                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `EsheetRendererProps`              | Renderer component props                                                             |
| `EsheetRendererHandle`             | Ref handle type (`getRawResponse`, `getValidResponse`, `getFormStore`, `getUIStore`) |
| `RendererTools`                    | Type for renderer MCP tool names                                                     |
| `ToolDefinition`                   | MCP tool definition type                                                             |
| `UseRendererMcpToolHandlerOptions` | Options for `useRendererMcpToolHandler`                                              |

### EsheetRendererProps

| Prop                   | Type                             | Default    | Description                                                       |
| ---------------------- | -------------------------------- | ---------- | ----------------------------------------------------------------- |
| `formDataInput`        | `unknown`                        | _required_ | Form definition (object, JSON string, YAML string, MCP, SurveyJS) |
| `className`            | `string`                         | `''`       | Additional CSS class for the root container                       |
| `initialResponses`     | `FormResponse`                   | --         | Pre-fill response data                                            |
| `strict`               | `boolean`                        | `false`    | Disable auto-detection, require a valid FormDefinition            |
| `onReady`              | `() => void`                     | --         | Called when the renderer is initialized                           |
| `onRendererToolsReady` | `(tools: RendererTools) => void` | --         | Called with MCP tool handler when ready                           |

---

## @esheet/renderer-standalone

### Functions

| Export                                      | Description                                                        |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `mountStandaloneRenderer(container, props)` | Mount `EsheetRenderer` into a DOM node and return a control handle |

### Types

| Export                           | Description                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| `EsheetRendererStandaloneHandle` | Handle with `unmount()`, `getResponse()`, and `getValidResponse()` |

---

## @esheet/renderer-blaze

### Functions

| Export                                 | Description                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `registerBlazeTemplate(templateName?)` | Register a Blaze template wrapper for the renderer. Returns `false` when required Blaze globals are not available, otherwise `true`. |

`registerBlazeTemplate` uses `esheetRenderer` as the default template name when no argument is provided.

---

## @esheet/adapters

Bidirectional converters for SurveyJS and MCP elicitation formats.

See the **[Adapters](/docs/adapters/overview)** section in the sidebar for detailed documentation including:

- [Adapters Overview](/docs/adapters/overview) — Installation, auto-detection, and all exports
- [SurveyJS Adapter](/docs/adapters/surveyjs) — Import/export, type mapping, conditional logic
- [MCP Adapter](/docs/adapters/mcp) — Import/export, constraints, type mapping
