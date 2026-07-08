---
sidebar_position: 7
---

# Conditional Logic

eSheet supports conditional rules that control field **visibility**, **enabled state**, and **required state** based on other field values or custom expressions.

## How Rules Work

Each field can have an optional `rules` array. Each rule defines:

1. **Effect** -- What happens when the rule evaluates to `true`
2. **Logic mode** -- How multiple conditions within the rule are combined
3. **Conditions** -- One or more conditions to evaluate

```typescript
interface ConditionalRule {
  effect: 'visible' | 'enable' | 'required';
  logic: 'AND' | 'OR';
  conditions: Condition[];
}
```

### Effects

| Effect     | Behavior when rule is `true`          | Default (no rules)       |
| ---------- | ------------------------------------- | ------------------------ |
| `visible`  | Field is shown                        | Visible                  |
| `enable`   | Field is interactive (not grayed out) | Enabled                  |
| `required` | Field must be answered                | Based on `required` prop |

### Logic Modes

| Mode  | Behavior                                   |
| ----- | ------------------------------------------ |
| `AND` | **All** conditions must be true            |
| `OR`  | **Any** condition being true is sufficient |

### Multiple Rules

When a field has **multiple rules with the same effect**, they combine with **OR** semantics -- if any rule evaluates to true, the effect is applied.

## Condition Types

### Field Conditions

Compare a target field's response against an expected value:

```typescript
interface Condition {
  conditionType: 'field';
  targetId: string; // Field ID to evaluate
  operator: ConditionOperator;
  expected?: string; // Value to compare against
  propertyAccessor?: string; // Optional: 'length', 'count'
}
```

### Expression Conditions

Evaluate a custom JavaScript-like expression using eSheet's safe evaluator. No `new Function` — works even when dangerous JS is disabled.

```typescript
interface Condition {
  conditionType: 'expression';
  expression: string; // e.g. '{fieldA} + {fieldB} > 100'
}
```

### JS Conditions

Evaluate arbitrary JavaScript. Requires both the host and schema to opt in via `allowDangerousJS` and `dangerouslyAllowJS`. When not opted in, JS conditions evaluate as `false`.

```typescript
interface Condition {
  conditionType: 'js';
  expression: string; // arbitrary JS, receives `responses` argument
}
```

See [Dangerous JS](./advanced/dangerous-js) for full setup requirements and security guidance.

## Operators

| Operator             | Description                                         | Works with                    |
| -------------------- | --------------------------------------------------- | ----------------------------- |
| `equals`             | Exact match                                         | Text, selection value         |
| `notEquals`          | Not equal                                           | Text, selection value         |
| `contains`           | Word-boundary match (whole words, case-insensitive) | Text answers                  |
| `includes`           | Array includes value                                | Multi-select (check, ranking) |
| `empty`              | Field has no answer                                 | All field types               |
| `notEmpty`           | Field has an answer                                 | All field types               |
| `greaterThan`        | Numeric greater than                                | Numeric text, rating values   |
| `greaterThanOrEqual` | Numeric >=                                          | Numeric text, rating values   |
| `lessThan`           | Numeric less than                                   | Numeric text, rating values   |
| `lessThanOrEqual`    | Numeric &lt;=                                       | Numeric text, rating values   |

:::note contains behaviour
`contains` matches on word boundaries, not arbitrary substrings. `"one two"` will match `"one two three"` but not `"onetwo"`. Use an expression condition for arbitrary substring matching.
:::

## Property Accessors

Access a specific property of the target field's response before comparing:

| Accessor | Description                    | Example use                               |
| -------- | ------------------------------ | ----------------------------------------- |
| `length` | Length of text answer or array | Check if multi-select has >= 3 selections |
| `count`  | Number of selected items       | Same as length for arrays                 |

```json
{
  "conditionType": "field",
  "targetId": "symptoms",
  "propertyAccessor": "length",
  "operator": "greaterThanOrEqual",
  "expected": "3"
}
```

## Expression Syntax Reference

Expression conditions (`conditionType: 'expression'`) support a JavaScript-like syntax for complex logic.

### Field References

Use `{fieldId}` to reference a field's answer value:

```json
{
  "conditionType": "expression",
  "expression": "{weight} > 100"
}
```

### Property Accessors in Expressions

Access properties on field values:

- `{fieldId}.length` — Length of text or array
- `{fieldId}.count` — Number of selected items (alias for length)

```json
{
  "conditionType": "expression",
  "expression": "{symptoms}.length >= 3"
}
```

### Supported Operators

| Category        | Operators                        | Example                            |
| --------------- | -------------------------------- | ---------------------------------- |
| Comparison      | `==`, `!=`, `>`, `>=`, `<`, `<=` | `{age} >= 18`                      |
| Strict equality | `===`, `!==`                     | `{status} === "active"`            |
| Logical         | `&&`, `\|\|`                     | `{a} > 0 && {b} > 0`               |
| Negation        | `!`                              | `!{hasAllergies}`                  |
| Arithmetic      | `+`, `-`, `*`, `/`, `%`          | `{weight} / ({height} * {height})` |
| Grouping        | `()`                             | `({a} + {b}) * 2`                  |

### Literal Values

- Numbers: `123`, `3.14`, `-5`
- Strings: `"text"` or `'text'`
- Booleans: `true`, `false`
- Null: `null`

### Complex Expression Examples

**BMI calculation check:**

```json
{
  "conditionType": "expression",
  "expression": "{weight} / (({height}/100) * ({height}/100)) > 25"
}
```

**Multiple field check:**

```json
{
  "conditionType": "expression",
  "expression": "{field1} > 0 && {field2} > 0 && {field3} != null"
}
```

**String comparison:**

```json
{
  "conditionType": "expression",
  "expression": "{status} == 'approved' || {override} == true"
}
```

## Examples

### Show a field when a specific option is selected

Show "Other reason" text field when the user selects "Other" in a radio:

```json
{
  "id": "other_reason",
  "fieldType": "text",
  "question": "Please specify",
  "inputType": "string",
  "rules": [
    {
      "effect": "visible",
      "logic": "AND",
      "conditions": [
        {
          "conditionType": "field",
          "targetId": "reason",
          "operator": "equals",
          "expected": "Other"
        }
      ]
    }
  ]
}
```

### Make a field required based on another answer

Require email when the user answers "Yes" to receiving updates:

```json
{
  "id": "email",
  "fieldType": "text",
  "question": "Email Address",
  "inputType": "email",
  "rules": [
    {
      "effect": "required",
      "logic": "AND",
      "conditions": [
        {
          "conditionType": "field",
          "targetId": "wants_updates",
          "operator": "equals",
          "expected": "Yes"
        }
      ]
    }
  ]
}
```

### Show field when ANY of multiple conditions are met (OR)

Show follow-up when ANY high-severity symptom is reported:

```json
{
  "id": "followup",
  "fieldType": "longtext",
  "question": "Please describe your symptoms in detail",
  "rules": [
    {
      "effect": "visible",
      "logic": "OR",
      "conditions": [
        {
          "conditionType": "field",
          "targetId": "headache_severity",
          "operator": "equals",
          "expected": "Severe"
        },
        {
          "conditionType": "field",
          "targetId": "back_pain_severity",
          "operator": "equals",
          "expected": "Severe"
        }
      ]
    }
  ]
}
```

### Enable based on numeric comparison

Enable a section only when the patient's age is 18 or older:

```json
{
  "id": "adult_section",
  "fieldType": "section",
  "title": "Adult Health History",
  "rules": [
    {
      "effect": "enable",
      "logic": "AND",
      "conditions": [
        {
          "conditionType": "field",
          "targetId": "age",
          "operator": "greaterThanOrEqual",
          "expected": "18"
        }
      ]
    }
  ],
  "fields": [
    { "id": "smoker", "fieldType": "boolean", "question": "Do you smoke?" }
  ]
}
```

### Expression-based condition

Show a BMI result field only when both weight and height have been filled:

```json
{
  "id": "bmi_display",
  "fieldType": "display",
  "content": "Your BMI is: *<{weight} / (({height}/100) * ({height}/100))>*",
  "rules": [
    {
      "effect": "visible",
      "logic": "AND",
      "conditions": [
        {
          "conditionType": "expression",
          "expression": "{weight} > 0 && {height} > 0"
        }
      ]
    }
  ]
}
```

### Multiple conditions with AND logic

Show a field only when BOTH conditions are met:

```json
{
  "rules": [
    {
      "effect": "visible",
      "logic": "AND",
      "conditions": [
        {
          "conditionType": "field",
          "targetId": "has_insurance",
          "operator": "equals",
          "expected": "Yes"
        },
        {
          "conditionType": "field",
          "targetId": "insurance_type",
          "operator": "notEquals",
          "expected": "Medicare"
        }
      ]
    }
  ]
}
```

## How Rules Are Evaluated

1. For each field, eSheet checks all rules matching the requested effect (`visible`, `enable`, or `required`)
2. Within a rule, conditions are combined with the rule's `logic` mode (`AND` or `OR`)
3. When multiple rules target the same effect, they use **OR** semantics -- if any rule passes, the effect is applied
4. Hidden fields (visibility = false) are excluded from validation
5. Disabled fields are excluded from validation
6. Rules are evaluated in real-time as users fill out the form
7. `conditionType: 'js'` evaluates as `false` when dangerous JS is not enabled — see [Dangerous JS](./advanced/dangerous-js)
