---
sidebar_position: 3
---

# Expression System

eSheet includes an expression evaluation system used in **conditional logic** and **display field interpolation**. Expressions can reference field values and perform arithmetic/logical operations.

## Syntax

### Field References

Reference any field's current answer value using curly braces:

```
{fieldId}
```

This resolves to:

- **Text fields** -> the `answer` string
- **Selection fields** -> the selected option's `value` string
- **Multi-select fields** -> the array of selected options
- **Numeric text fields** -> the numeric value (auto-parsed)

### Computed Expressions

Wrap arithmetic or logical expressions in angle brackets:

```
<{fieldA} + {fieldB}>
```

Supports standard JavaScript-like operators:

- **Arithmetic:** `+`, `-`, `*`, `/`, `%`
- **Comparison:** `>`, `>=`, `<`, `<=`, `==`, `!=`, `===`, `!==`
- **Logical:** `&&`, `||`, `!`
- **Grouping:** `(`, `)`
- **Property access:** `.length`, `.count`

## Use in Display Fields

Display fields support inline expression interpolation in their `content` property:

```yaml
id: summary
fieldType: display
content: |-
  # Summary

  Patient: *{name}*
  Age: *{age}*

  BMI: *<{weight} / (({height}/100) * ({height}/100))>*

  Total symptoms: *<{symptoms}.length>*
```

### Markdown + Expressions

Display fields combine a Markdown-like syntax with expression interpolation:

| Syntax         | Renders as        |
| -------------- | ----------------- |
| `*text*`       | **bold**          |
| `-text-`       | _italic_          |
| `_text_`       | underline         |
| `~text~`       | ~~strikethrough~~ |
| `- item`       | bullet list       |
| `# Heading`    | heading           |
| `{fieldId}`    | field value       |
| `<expression>` | computed result   |

### Examples

**Simple value display:**

```
Your name is: *{name}*
```

**Arithmetic:**

```
Total: *<{price} * {quantity}>*
```

**Conditional text (expression in condition rule, not in display):**

```yaml
rules:
  - effect: visible
    logic: AND
    conditions:
      - conditionType: expression
        expression: '{age} >= 18'
```

## Use in Conditional Logic

Expression conditions in rules allow complex logic beyond simple field comparisons:

```yaml
conditionType: expression
expression: '{weight} > 0 && {height} > 0'
```

### Expression Condition Examples

| Expression                               | Description                           |
| ---------------------------------------- | ------------------------------------- |
| `{age} >= 18`                            | Age is 18 or older                    |
| `{weight} > 0 && {height} > 0`           | Both weight and height are filled     |
| `{score} >= 80`                          | Score is 80 or above                  |
| `{symptoms}.length >= 3`                 | At least 3 symptoms selected          |
| `{systolic} > 140 \|\| {diastolic} > 90` | Either blood pressure reading is high |

## Validation

Use `isExpressionValid()` from `@esheet/core` to validate expression syntax:

```tsx
import { isExpressionValid } from '@esheet/core';

isExpressionValid('{age} >= 18'); // true
isExpressionValid('{weight} / {height}'); // true
isExpressionValid('{incomplete expression'); // false
```

## How Evaluation Works

1. Field references (`{fieldId}`) are resolved against the current FormStore responses
2. The expression string is parsed and evaluated with resolved values
3. For display fields, the result is converted to a string and inserted inline
4. For conditional rules, the result is coerced to a boolean

:::warning
Expressions are evaluated client-side. Do not use them for security-sensitive logic. Always validate on the server.
:::
