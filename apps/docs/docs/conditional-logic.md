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

| Effect | Behavior when rule is `true` | Default (no rules) |
|---|---|---|
| `visible` | Field is shown | Visible |
| `enable` | Field is interactive (not grayed out) | Enabled |
| `required` | Field must be answered | Based on `required` prop |

### Logic Modes

| Mode | Behavior |
|---|---|
| `AND` | **All** conditions must be true |
| `OR` | **Any** condition being true is sufficient |

### Multiple Rules

When a field has **multiple rules with the same effect**, they combine with **OR** semantics -- if any rule evaluates to true, the effect is applied.

## Condition Types

### Field Conditions

Compare a target field's response against an expected value:

```typescript
interface Condition {
  conditionType: 'field';
  targetId: string;          // Field ID to evaluate
  operator: ConditionOperator;
  expected?: string;         // Value to compare against
  propertyAccessor?: string; // Optional: 'length', 'count'
}
```

### Expression Conditions

Evaluate a custom JavaScript-like expression:

```typescript
interface Condition {
  conditionType: 'expression';
  expression: string; // e.g. '{fieldA} + {fieldB} > 100'
}
```

## Operators

| Operator | Description | Works with |
|---|---|---|
| `equals` | Exact match | Text, selection value |
| `notEquals` | Not equal | Text, selection value |
| `contains` | Text contains substring | Text answers |
| `includes` | Array includes value | Multi-select (check, ranking) |
| `empty` | Field has no answer | All field types |
| `notEmpty` | Field has an answer | All field types |
| `greaterThan` | Numeric greater than | Numeric text, rating values |
| `greaterThanOrEqual` | Numeric >= | Numeric text, rating values |
| `lessThan` | Numeric less than | Numeric text, rating values |
| `lessThanOrEqual` | Numeric &lt;= | Numeric text, rating values |

## Property Accessors

Access a specific property of the target field's response before comparing:

| Accessor | Description | Example use |
|---|---|---|
| `length` | Length of text answer or array | Check if multi-select has >= 3 selections |
| `count` | Number of selected items | Same as length for arrays |

```json
{
  "conditionType": "field",
  "targetId": "symptoms",
  "propertyAccessor": "length",
  "operator": "greaterThanOrEqual",
  "expected": "3"
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
