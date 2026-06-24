---
sidebar_position: 4
---

# Dangerous JS

eSheet includes an optional advanced mode that enables runtime JavaScript for:

- Field `calculation` expressions — derive a field's value from other fields
- Rule conditions with `conditionType: 'js'` — drive visibility, enable, and required state with arbitrary JS

Both features share the same security gate and the same execution context. They are documented on separate pages:

- [**Calculations**](./dangerous-js-calculations) — auto-computed field values
- [**Conditions**](./dangerous-js-conditions) — JS-driven conditional rules

---

## The Dual Opt-In Gate

Dangerous JS executes **only when both layers are enabled**. Either layer missing is sufficient to prevent execution.

### 1. Host opt-in

Pass `allowDangerousJS={true}` to the host component:

```tsx
// Renderer
<EsheetRenderer formDataInput={def} allowDangerousJS={true} />

// Builder
<EsheetBuilder definition={def} allowDangerousJS={true} />

// Standalone renderer function
renderTree(definition, responses, { allowDangerousJS: true });
```

### 2. Schema opt-in

Set `dangerouslyAllowJS: true` at the top level of the `FormDefinition`:

```json
{
  "id": "my-form",
  "dangerouslyAllowJS": true,
  "fields": []
}
```

If either is absent or `false`:

- `calculation` expressions do not run
- `conditionType: 'js'` always evaluates as `false`
- Safe `conditionType: 'expression'` and `conditionType: 'field'` continue to work normally

:::info Cannot be bypassed at runtime
Host permission is sealed when the form store is created. `store.setState({ dangerouslyAllowJS: true })` is intercepted and clamped by the host-level flag — a rogue schema cannot self-authorize JS execution.
:::

---

## Execution Scope

JS expressions run via `new Function`. They are **not sandboxed** — code has access to the browser's global scope:

| Always in scope                                  | Requires host injection                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `responses` — within-form field values           | `context` — host-supplied EHR data, named observations, patient demographics (see [contextData](./dangerous-js-calculations#contextdata)) |
| `Date`, `Math`, `JSON`, `parseInt`, `parseFloat` | —                                                                                                                                         |
| All `window` / `globalThis` properties           | —                                                                                                                                         |

:::danger Security Warning
These features execute arbitrary JavaScript at runtime. Enable dangerous JS only when all schema content is fully trusted and controlled by your organization. Do not enable it for user-authored or externally supplied schemas.
:::

---

## Security Guidance

**Prefer expression conditions first.** Use `conditionType: 'expression'` whenever possible — it is safer and handles the majority of business rules without JS.

**Restrict where dangerous JS is enabled.** Enable it only in trusted environments with controlled schema sources (internal tools, EHR integrations, developer tooling).

**Keep untrusted schema paths on safe mode.** For any runtime import, external integration, or user-authored schema flow, leave `allowDangerousJS` disabled.

**Add host-side controls in production:**

- Trusted schema source checks
- Integrity verification (signatures / checksums)
- Environment-specific kill switch to force-disable dangerous JS

---

## Runtime Notes

**Calculation failures are non-fatal.** If a calculation throws, the result is ignored and the previous field value is preserved.

**Calculated fields are still editable.** There is no automatic `readonly` enforcement on calculated fields.

**Calculations run on each response update.** Every `setResponse` triggers a full pass over all fields with a `calculation` string. Keep expressions cheap — avoid network calls, DOM access, or heavy computation.

**JS conditions do not fall back.** `conditionType: 'js'` does not fall through to the safe expression engine. If `dangerouslyAllowJS` is `false`, the condition evaluates as `false` (field hidden / disabled / not required). Design forms so the default state is safe when JS is off.

**No sandboxing.** `new Function` is not sandboxed. Do not use this feature with schema content you do not control.

---

## Choosing The Right Mode

| Use case                                           | Recommended feature                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Compute a derived value from other fields          | [Calculation](./dangerous-js-calculations)                                                                 |
| Reference EHR observations or patient data         | [Calculation](./dangerous-js-calculations) or [JS Condition](./dangerous-js-conditions) with `contextData` |
| Simple arithmetic / field comparisons              | [Expression Condition](./dangerous-js-conditions#expression-conditions-conditiontype-expression)           |
| Complex rule unsupported by expression syntax      | [JS Condition](./dangerous-js-conditions)                                                                  |
| Field-to-field comparison without helper functions | [Field Condition](../conditional-logic)                                                                    |

---

## Implementation Reference

| Symbol                                   | Package            | Description                                                           |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `EsheetRenderer` prop `allowDangerousJS` | `@esheet/renderer` | **Host gate** — must be `true` for JS to run in the renderer          |
| `EsheetBuilder` prop `allowDangerousJS`  | `@esheet/builder`  | **Host gate** — must be `true` for JS to run in the builder           |
| `RenderTreeOptions.allowDangerousJS`     | `@esheet/renderer` | **Host gate** for the standalone `renderTree()` function              |
| `EsheetRenderer` prop `contextData`      | `@esheet/renderer` | Host-supplied map exposed as `context` inside JS expressions          |
| `FormDefinition.dangerouslyAllowJS`      | `@esheet/core`     | Schema-level opt-in — required alongside host opt-in                  |
| `BaseFieldDefinition.calculation`        | `@esheet/core`     | JS expression string that auto-sets a field's value                   |
| `conditionType: 'js'`                    | `@esheet/core`     | Condition type for arbitrary JS rules                                 |
| `evaluateJsExpression()`                 | `@esheet/core`     | Internal evaluator — runs expression with `responses` and `context`   |
| `FormState.dangerouslyAllowJS`           | `@esheet/core`     | Reactive state — reflects `schema.dangerouslyAllowJS && hostAllowsJS` |
| `FormState.contextData`                  | `@esheet/core`     | Reactive state — current host-supplied context map                    |
| `FormState.setContextData()`             | `@esheet/core`     | Action — replaces the context map and triggers re-evaluation          |
| `FormState.setDangerouslyAllowJS()`      | `@esheet/core`     | Toggle the flag — clamped by host permission                          |

eSheet includes an optional advanced mode that allows runtime JavaScript for:

- Field `calculation` expressions
- Rule conditions with `conditionType: 'js'`

This mode is intentionally locked down behind explicit host and schema opt-in.

:::danger Security Warning
These features execute arbitrary JavaScript code at runtime using `new Function`.

Enable dangerous JS only when all schema content is fully trusted and controlled by your organization. Do not enable it for user-authored or externally supplied schemas.
:::

---

## How The Gate Works

Dangerous JS executes only when **both layers** are enabled.

### 1. Host opt-in (required)

Pass `allowDangerousJS={true}` to the host component. Without this, JS never executes regardless of what the schema says.

```tsx
// Builder
<EsheetBuilder definition={def} allowDangerousJS={true} />

// Renderer
<EsheetRenderer formDataInput={def} allowDangerousJS={true} />

// Standalone renderer function
renderTree(definition, responses, { allowDangerousJS: true });
```

### 2. Schema opt-in (required)

Set `dangerouslyAllowJS: true` at the top level of your `FormDefinition`:

```json
{
  "id": "my-form",
  "dangerouslyAllowJS": true,
  "fields": [...]
}
```

Both must be `true`. If either is missing or `false`:

- `calculation` expressions do not run
- `conditionType: 'js'` evaluates as `false`
- Safe `conditionType: 'expression'` continues to work

This means the host always controls whether dangerous JS can execute.

:::info Cannot be bypassed at runtime
Host permission is sealed when the form store is created. Runtime state mutations cannot elevate dangerous JS to `true` unless the host already allowed it.
:::

---

## Calculations

A `calculation` is a JavaScript expression attached to a field. It is evaluated on response changes and writes the computed value back into that field.

### Schema

Add a `calculation` string to any field definition:

```json
{
  "id": "bmi",
  "fieldType": "text",
  "question": "BMI",
  "calculation": "Math.round((responses['weight'] / Math.pow(responses['height'] / 100, 2)) * 10) / 10"
}
```

### Context

Calculation code receives a single argument named `responses`.

`responses` is a flat `Record<string, unknown>` where each key is a field ID mapped to a normalized value:

| Field type          | `responses['id']` value                                    |
| ------------------- | ---------------------------------------------------------- |
| Text / longtext     | Number if parseable, otherwise the raw string              |
| Radio / dropdown    | Option score (if set), otherwise option value string       |
| Check / multiselect | Array of selected option values (or scores if any are set) |
| Rating / slider     | Option score or numeric value                              |
| All others          | Raw `answer` string                                        |

The expression is wrapped as:

```js
new Function('responses', 'return ' + calculation)(data);
```

So the calculation must be a returnable JavaScript expression:

```js
// ✅ Valid — single expression
"responses['systolic'] - responses['diastolic']";

// ✅ Valid — ternary expression
"responses['age'] >= 18 ? 'Adult' : 'Minor'";

// ✅ Valid — uses JS built-ins
"new Date(responses['dob']).getFullYear() - new Date().getFullYear()";

// ❌ Invalid — statement syntax
"const x = responses['a']; return x + 1;";
```

### Behavior

- Calculations run after every `setResponse` call.
- Calculated field values are stored as `{ answer: String(result) }`.
- If the calculation throws or returns `null`/`undefined`, the field's response is left unchanged.
- Calculated fields can be manually edited, but may be overwritten on the next response change.
- Calculation writes do not recursively trigger another calculation pass.

### Example

Add 6 months to a "last encounter" date field:

```json
{
  "id": "follow-up-date",
  "fieldType": "text",
  "question": "Suggested Follow-up Date",
  "calculation": "(() => { const d = new Date(responses['last-encounter']); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })()"
}
```

### Builder UI

When dangerous JS is enabled, the builder shows a **Calculation (JS)** textarea in field editing.

---

## Conditions: Expression vs JS

eSheet supports three condition modes:

- `field`: target field + operator + expected value
- `expression`: safe expression engine (recommended default)
- `js`: arbitrary JavaScript (dangerous mode)

### Expression Conditions (`conditionType: 'expression'`)

Expression conditions use eSheet's safe expression evaluator.

- Field references use `{fieldId}` syntax
- Supported operators include arithmetic, comparison, boolean operators, and `.length`/`.count`
- Evaluation does not use `new Function`
- Works even when dangerous JS is disabled

Example:

```json
{
  "conditionType": "expression",
  "expression": "{temperature} >= 38 && {symptoms}.count > 1"
}
```

### JS Conditions (`conditionType: 'js'`)

A JS condition drives `visible` / `enable` / `required` using arbitrary JavaScript.

### Schema

```json
{
  "id": "followup-section",
  "fieldType": "section",
  "rules": [
    {
      "effect": "visible",
      "logic": "AND",
      "conditions": [
        {
          "conditionType": "js",
          "expression": "requireTimeBetween(responses['encounter-date'], 30, 90)"
        }
      ]
    }
  ]
}
```

### Context

JS conditions receive the same `responses` argument and normalization model as calculations.

```js
new Function('responses', 'return ' + expression)(data);
```

The expression must evaluate to a truthy value for the condition to pass.

If dangerous JS is disabled, `conditionType: 'js'` evaluates as `false`.

### Builder UI

When dangerous JS is enabled, the Logic Editor shows a **JS** tab alongside **Field** and **Expression** condition modes.

---

## Choosing The Right Mode

| Use case                                            | Feature              |
| --------------------------------------------------- | -------------------- |
| Compute a derived value from other fields           | Calculation          |
| Auto-fill a date based on another date field        | Calculation          |
| Complex rule unsupported by expression syntax       | JS Condition         |
| Simple arithmetic comparisons                       | Expression Condition |
| Field-to-field comparisons without helper functions | Expression Condition |

---

## Security Guidance

### Prefer expression conditions first

Use `conditionType: 'expression'` whenever possible. It is safer and usually sufficient for business rules.

### Restrict where dangerous JS is enabled

Enable dangerous JS only in trusted environments with controlled schema sources.

### Keep untrusted schema paths on safe mode

For any runtime import, external integration, or user-authored schema flow, keep `allowDangerousJS` disabled.

### Add host-side controls

Recommended host controls in production:

- Trusted schema source checks
- Integrity verification (signatures/checksums)
- Environment-specific kill switch to force-disable dangerous JS

---

## Runtime Notes

### Both layers are required

`dangerouslyAllowJS: true` must be in the schema **and** `allowDangerousJS={true}` must be passed to the host component. Neither alone is sufficient. This prevents accidental evaluation when the host hasn't opted in, and prevents a rogue schema from self-authorizing JS execution in a context that doesn't expect it.

### Calculation failures are non-fatal

If a calculation throws, the result is ignored and the previous value is preserved.

### Calculated fields are still editable

There is no automatic `readonly` enforcement for calculated fields.

### Calculation runs on each response update

Each `setResponse` triggers a full pass through all fields with a `calculation`. For large forms with many calculations, keep expressions cheap. Avoid heavy computation (network calls, DOM access) inside calculations.

### JS conditions do not fall back to expression mode

`conditionType: 'js'` does not fall through to the safe expression engine. If `dangerouslyAllowJS` is false, the condition always evaluates to `false` (the field is hidden/disabled/not-required). Design your form so the default state is safe when JS is off.

### No sandboxing

`new Function` is not sandboxed — code has full access to the browser's global scope (`window`, `document`, etc.). Do not use this feature with schema content you do not control.

---

## Implementation Reference

| Symbol                                   | Package            | Description                                                                              |
| ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `EsheetBuilder` prop `allowDangerousJS`  | `@esheet/builder`  | **Host gate** — must be `true` for JS to run in the builder                              |
| `EsheetRenderer` prop `allowDangerousJS` | `@esheet/renderer` | **Host gate** — must be `true` for JS to run in the renderer                             |
| `RenderTreeOptions.allowDangerousJS`     | `@esheet/renderer` | **Host gate** for the standalone `renderTree()` function                                 |
| `FormDefinition.dangerouslyAllowJS`      | `@esheet/core`     | Schema-level opt-in — also required (both must be true)                                  |
| `BaseFieldDefinition.calculation`        | `@esheet/core`     | JS expression string that auto-sets this field's value                                   |
| `conditionType: 'js'`                    | `@esheet/core`     | Condition type for arbitrary JS conditions                                               |
| `evaluateJsExpression()`                 | `@esheet/core`     | Exported evaluator — runs expr with field data context                                   |
| `FormState.dangerouslyAllowJS`           | `@esheet/core`     | Reactive store state — reflects `schema.dangerouslyAllowJS && hostAllowsJS`              |
| `FormState.setDangerouslyAllowJS()`      | `@esheet/core`     | Toggle the flag — clamped by host permission; `true` is a no-op when host did not opt in |
