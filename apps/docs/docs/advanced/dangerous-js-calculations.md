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
new Function('responses', 'return ' + calculation)(data);
```

So the string must be a returnable expression:

```js
// ✅ Valid — single expression
"responses['systolic'] - responses['diastolic']";

// ✅ Valid — ternary
"responses['age'] >= 18 ? 'Adult' : 'Minor'";

// ✅ Valid — IIFE for multi-step logic
"(() => { const d = new Date(responses['last-encounter']); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })()";

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

| Legacy function                   | eSheet equivalent                     |
| --------------------------------- | ------------------------------------- |
| `observationValueByName("field")` | `responses['field-id']` (within-form) |

---

## Builder UI

When `allowDangerousJS={true}` is passed to `<EsheetBuilder>` and the loaded schema has `dangerouslyAllowJS: true`, the field editor shows a **Calculation (JS)** textarea where the expression can be entered directly.
