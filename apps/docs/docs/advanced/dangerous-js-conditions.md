---
sidebar_position: 6
sidebar_label: Conditions
---

# Dangerous JS — Conditions

eSheet supports three condition modes for driving field visibility, enabled state, and required state. Two are safe (no JS execution); one requires the [dual opt-in gate](./dangerous-js#the-dual-opt-in-gate).

---

## Condition Modes Overview

| Mode       | `conditionType` | Requires dangerous JS? | When to use                                        |
| ---------- | --------------- | ---------------------- | -------------------------------------------------- |
| Field      | `'field'`       | No                     | Direct comparison against another field's value    |
| Expression | `'expression'`  | No                     | Arithmetic or boolean logic across multiple fields |
| JS         | `'js'`          | **Yes**                | Complex logic, date windows, arbitrary JavaScript  |

All three modes are evaluated inside a `ConditionalRule`:

```yaml
effect: visible
logic: AND
conditions:
  - conditionType: field
    targetId: pain-level
    operator: greaterThan
    expected: '3'
```

---

## Field Conditions (`conditionType: 'field'`)

Reference another field's response directly. Does not require dangerous JS.

```yaml
conditionType: field
targetId: has-allergies
operator: equals
expected: 'Yes'
```

**Available operators:**

| Operator             | Description                        |
| -------------------- | ---------------------------------- |
| `equals`             | Value equals expected              |
| `notEquals`          | Value does not equal expected      |
| `contains`           | String contains expected substring |
| `includes`           | Array includes expected item       |
| `empty`              | Value is empty / unanswered        |
| `notEmpty`           | Value is present / answered        |
| `greaterThan`        | Numeric value `>` expected         |
| `greaterThanOrEqual` | Numeric value `>=` expected        |
| `lessThan`           | Numeric value `<` expected         |
| `lessThanOrEqual`    | Numeric value `<=` expected        |

**Property accessor** — use `.length` or `.count` on array responses:

```yaml
conditionType: field
targetId: symptoms
operator: greaterThan
expected: '2'
propertyAccessor: count
```

---

## Expression Conditions (`conditionType: 'expression'`)

Use eSheet's safe expression evaluator. Does not require dangerous JS.

- Field references use `{fieldId}` syntax
- Supports arithmetic (`+`, `-`, `*`, `/`, `%`), comparison (`==`, `!=`, `<`, `<=`, `>`, `>=`), and logical (`&&`, `||`, `!`) operators
- Supports `{fieldId}.length` and `{fieldId}.count` property accessors
- Does **not** use `new Function` — evaluation is sandboxed by design
- Works even when dangerous JS is disabled

```yaml
conditionType: expression
expression: '{temperature} >= 38 && {symptoms}.count > 1'
```

```yaml
conditionType: expression
expression: "{total-score} >= 8 || {override-flag} == 'Yes'"
```

For most business rules, expression conditions are sufficient. Use JS conditions only when the logic requires function calls, date manipulation, or external data.

---

## JS Conditions (`conditionType: 'js'`)

Arbitrary JavaScript for complex conditional logic. Requires `dangerouslyAllowJS: true` in the schema and `allowDangerousJS={true}` on the host component.

### Schema

```yaml
id: followup-section
fieldType: section
rules:
  - effect: visible
    logic: AND
    conditions:
      - conditionType: js
        expression: responses['has-symptoms'] === 'Yes' && new Date() > new Date(responses['onset-date'])
```

The expression must evaluate to a **truthy value** for the condition to pass. If `dangerouslyAllowJS` is disabled, `conditionType: 'js'` always evaluates as `false`.

### Expression Context

Every JS condition receives two arguments:

#### `responses`

A flat `Record<string, unknown>` — same shape as [calculations](./dangerous-js-calculations#responses):

| Field type                      | `responses['id']` value                              |
| ------------------------------- | ---------------------------------------------------- |
| `text` / `longtext`             | Number if parseable, otherwise raw string            |
| `radio` / `dropdown`            | Option score (if set), otherwise option value string |
| `check` / `multiselectdropdown` | Array of selected values (or scores if any are set)  |
| `rating` / `slider`             | Option score or numeric value                        |
| `boolean`                       | Option value string (`'Yes'` / `'No'` by default)    |
| All others                      | Raw `answer` string                                  |

The internal call signature is:

```js
new Function('responses', 'return ' + expression)(data);
```

---

## Examples

### Date window — PPD read date

Replaces legacy moment.js date range conditionals (`moment(date).isBetween(...)`):

```yaml
conditionType: js
expression: (() => { const tested = new Date(responses['ppd-date-tested']); if (!tested || isNaN(tested)) return false; const now = new Date(); const diffDays = (now - tested) / (1000 * 60 * 60 * 24); return diffDays >= 2 && diffDays <= 8; })()
```

### Today relative date comparisons

Replaces legacy `todayIsAfter()`, `todayIsBefore()`, `todayIsBetween()`, `todayIsDate()`:

```yaml
conditionType: js
expression: new Date() > new Date('2019-06-24')
```

```yaml
conditionType: js
expression: new Date() < new Date('2007-02-13')
```

```yaml
conditionType: js
expression: new Date() >= new Date('2019-12-15') && new Date() <= new Date('2020-03-25')
```

### Multi-OR: show if yes was answered to any of several fields

Replaces legacy multi-`observationDisplay` OR chains:

```yaml
effect: visible
logic: OR
conditions:
  - conditionType: js
    expression: responses['fatigue-field'] === 'Yes'
  - conditionType: js
    expression: responses['sleep-problems-field'] === 'Yes'
  - conditionType: js
    expression: responses['sleeping-aids-field'] === 'Yes'
```

Or equivalently with a single JS condition:

```yaml
conditionType: js
expression: "['fatigue-field', 'sleep-problems-field', 'sleeping-aids-field'].some(id => responses[id] === 'Yes')"
```

### Show if any observation is answered (not empty, not zero)

Replaces legacy `observationValueByName('name') && observationValueByName('name') !== 0`:

```yaml
conditionType: js
expression: responses['pain-scale'] !== '' && responses['pain-scale'] !== 0
```

---

## Legacy Migration Reference

| Legacy function / pattern        | eSheet equivalent                                               |
| -------------------------------- | --------------------------------------------------------------- |
| `observationValueByName('name')` | `responses['field-id']` (within-form field reference)           |
| `jQuery.inArray(val, arr) > -1`  | `arr.includes(val)` in JS condition                             |
| `miearray.inSet(val, arr)`       | `arr.includes(val)` in JS condition                             |
| `todayIsAfter('date')`           | `new Date() > new Date('date')`                                 |
| `todayIsBefore('date')`          | `new Date() < new Date('date')`                                 |
| `todayIsBetween('d1', 'd2')`     | `new Date() >= new Date('d1') && new Date() <= new Date('d2')`  |
| `todayIsDate('date')`            | `new Date().toDateString() === new Date('date').toDateString()` |
| Moment.js `isBetween`            | Native `Date` arithmetic — see PPD date window example above    |

---

## Builder UI

When `allowDangerousJS={true}` is passed to `<EsheetBuilder>` and the loaded schema has `dangerouslyAllowJS: true`, the Logic Editor's condition row shows a **JS** tab alongside **Field** and **Expression** condition modes.
