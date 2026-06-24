---
sidebar_position: 5
sidebar_label: Calculations
---

# Dangerous JS — Calculations

A **calculation** is a JavaScript expression attached to a field definition. It is evaluated after every response change and writes the computed result back into that field.

Calculations require the [dual opt-in gate](./dangerous-js#the-dual-opt-in-gate) — both the host `allowDangerousJS` prop and the schema `dangerouslyAllowJS: true` flag must be set.

---

## Schema

Add a `calculation` string to any field definition:

```json
{
  "id": "bmi",
  "fieldType": "text",
  "question": "BMI",
  "calculation": "Math.round((responses['weight'] / Math.pow(responses['height'] / 100, 2)) * 10) / 10"
}
```

The `calculation` is a **JavaScript expression** (not a statement). It is wrapped internally as:

```js
new Function('responses', 'context', 'return ' + calculation)(data, ctx);
```

So the string must be a returnable expression:

```js
// ✅ Valid — single expression
"responses['systolic'] - responses['diastolic']";

// ✅ Valid — ternary
"responses['age'] >= 18 ? 'Adult' : 'Minor'";

// ✅ Valid — IIFE for multi-step logic
"(() => { const d = new Date(responses['last-encounter']); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })()";

// ✅ Valid — uses context (host-injected data)
"Number(context['travel-risk-factor'] ?? 0) + Number(context['age-risk-factor'] ?? 0)";

// ❌ Invalid — statement syntax
"const x = responses['a']; return x + 1;";
```

---

## Expression Context

Every calculation receives two arguments:

### `responses`

A flat `Record<string, unknown>` where each key is a field ID mapped to its normalized value:

| Field type                      | `responses['id']` value                              |
| ------------------------------- | ---------------------------------------------------- |
| `text` / `longtext`             | Number if parseable, otherwise raw string            |
| `radio` / `dropdown`            | Option score (if set), otherwise option value string |
| `check` / `multiselectdropdown` | Array of selected values (or scores if any are set)  |
| `rating` / `slider`             | Option score or numeric value                        |
| `boolean`                       | Option value string (`'Yes'` / `'No'` by default)    |
| All others                      | Raw `answer` string                                  |

Unanswered fields return an empty string `''`.

### `context`

A `Record<string, unknown>` populated by the host app via the `contextData` prop. Defaults to `{}`.

Use `context` to reference data that lives outside the form — EHR observations, discrete values, patient demographics, and similar external state.

```js
// Within a calculation expression:
Number(context['Travel duration risk factor'] ?? 0) +
  Number(context['Americas risk'] ?? 0) +
  Number(context['Age risk'] ?? 0);
```

---

## `contextData` Prop

Pass `contextData` to `<EsheetRenderer>` to populate the `context` variable inside all JS expressions:

```tsx
<EsheetRenderer
  formDataInput={schema}
  allowDangerousJS={true}
  contextData={{
    // Named EHR observations
    'Travel duration risk factor': 3,
    'Americas risk': 1,
    'Asia Pacific risk': 2,
    // Patient demographics
    patient: {
      sex: 'M',
      dob: '1985-03-12',
    },
  }}
/>
```

`contextData` is synced into the store on every render. When it changes, any field whose `calculation` references `context` will re-evaluate on the next `setResponse` call.

:::note Only evaluated when `dangerouslyAllowJS` is active
`context` is always passed to expressions as an argument, but it has no effect unless `allowDangerousJS={true}` and `dangerouslyAllowJS: true` in the schema are both set.
:::

### Accessing context values

```js
// Direct key access
context['HPI Pain Assessment'];

// Nested object
context.patient.sex;

// Safe numeric access with default fallback
Number(context['score-factor'] ?? 0);

// Safe string comparison
context['Last PPD Result'] === 'Positive';
```

### Using `setContextData()` directly (store API)

If you are working directly with the form store (outside React), use `setContextData`:

```ts
import { createFormStore } from '@esheet/core';

const store = createFormStore(definition, true /* hostAllowsJS */);
store.getState().setContextData({
  'Travel duration risk factor': 3,
  patient: { sex: 'M' },
});
```

---

## Behavior

- Calculations run after every `setResponse` call.
- All fields with a `calculation` are re-evaluated in a single pass after each response update.
- Results are stored as `{ answer: String(result) }`.
- If the calculation throws or returns `null` / `undefined`, the field's response is left unchanged.
- Calculated fields can be manually edited but may be overwritten on the next response change.
- Calculation writes do not recursively trigger another calculation pass.

---

## Examples

### BMI from weight and height

```json
{
  "id": "bmi",
  "fieldType": "text",
  "question": "BMI",
  "calculation": "Math.round((responses['weight'] / Math.pow(responses['height'] / 100, 2)) * 10) / 10"
}
```

### Suggested follow-up date (6 months out)

```json
{
  "id": "follow-up",
  "fieldType": "text",
  "question": "Suggested Follow-up Date",
  "calculation": "(() => { const d = new Date(responses['last-encounter']); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })()"
}
```

### Risk score from host-injected discrete values

This pattern replaces the legacy `discreteNumberByName()` function:

```json
{
  "id": "total-risk-score",
  "fieldType": "text",
  "question": "Total Risk Score",
  "calculation": "Number(context['Age risk'] ?? 0) + Number(context['Travel duration risk'] ?? 0) + Number(context['Americas'] ?? 0) + Number(context['Asia Pacific'] ?? 0) + responses['form-risk-field']"
}
```

```tsx
// Host app
<EsheetRenderer
  formDataInput={schema}
  allowDangerousJS={true}
  contextData={{
    'Age risk': patientAgeRisk,
    'Travel duration risk': travelDurationRisk,
    Americas: americasRisk,
    'Asia Pacific': asiaPacificRisk,
  }}
/>
```

### Age from date of birth

```json
{
  "id": "calculated-age",
  "fieldType": "text",
  "question": "Age",
  "calculation": "(() => { const dob = new Date(responses['dob']); if (!dob || isNaN(dob)) return ''; const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--; return age; })()"
}
```

### Conditional label from another field

```json
{
  "id": "risk-label",
  "fieldType": "display",
  "question": "Risk Level",
  "calculation": "responses['total-risk-score'] >= 8 ? 'High Risk' : responses['total-risk-score'] >= 4 ? 'Moderate Risk' : 'Low Risk'"
}
```

---

## Legacy Migration Reference

The following legacy WebChart/EH functions have equivalents using `responses` and `context`:

| Legacy function                   | eSheet equivalent                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `observationValueByName("field")` | `responses['field-id']` (within-form) or `context['field name']` (via `contextData`) |
| `discreteValueByName("name")`     | `context['name']` (inject via `contextData`)                                         |
| `discreteNumberByName("name")`    | `Number(context['name'] ?? 0)` (inject via `contextData`)                            |
| `discreteNumberByName("name", 5)` | `Number(context['name'] ?? 5)`                                                       |

---

## Builder UI

When `allowDangerousJS={true}` is passed to `<EsheetBuilder>` and the loaded schema has `dangerouslyAllowJS: true`, the field editor shows a **Calculation (JS)** textarea where the expression can be entered directly.
