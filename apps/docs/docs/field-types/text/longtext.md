---
slug: /field-types/longtext
---

# longtext

Multi-line textarea for longer responses.

## Height

By default, an empty longtext field starts at the same height as a single-line
input. It grows with newlines and wrapped text, including saved answers, and
shrinks as text is removed. Width changes and programmatic answer updates also
recalculate its height. Multiline answers remain plain strings.

Set **Minimum rows** in the builder, or a positive integer `rows` in the field
definition, to use a taller initial and minimum height. The field still grows
when its content needs more space. Clear **Minimum rows** or omit `rows` to
restore the single-line default. This applies in builder preview and rendered
forms; touch mode may enforce its larger accessible minimum height.

Set **Maximum rows** in the builder, or a positive integer `maxRows` in the field
definition, to limit growth. Longer answers scroll inside the textarea once it
reaches that height. The limit must be at least **Minimum rows** (`rows`, or one
when omitted). Clear **Maximum rows** or omit `maxRows` for unlimited growth.
The cap follows the current line height and includes the control's padding and
borders, including touch-mode padding.

The shared `@mieweb/ui` textarea provides auto-sizing. Host styles can deliberately
cap its height with CSS `max-height`; content then scrolls within that limit.

## Answer Format

```yaml
answer: string value
```

## Example

```yaml
id: notes
fieldType: longtext
question: Additional Notes
```

For an explicit five-row baseline:

```yaml
id: notes
fieldType: longtext
question: Additional Notes
rows: 5
```

To start at two rows and grow up to eight:

```yaml
id: notes
fieldType: longtext
question: Additional Notes
rows: 2
maxRows: 8
```
