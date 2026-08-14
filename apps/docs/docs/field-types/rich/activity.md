---
slug: /field-types/activity
---

# activity

Read-only, append-only log of response changes over time. Include an
`activity` field on any page (commonly its own page) and the form store fills
it in automatically: whenever a response value changes, an entry is appended
recording who changed what, when, and the display form of the previous and new
values.

Entries are debounced per field — consecutive changes to the same field within
a short window (keystrokes) collapse into one entry that keeps the original
`from` and the latest `to`. Entries are GUID-keyed and live under the reserved
`_activity` response key, so concurrent logs union-merge exactly like notes
(`mergeActivity` from `@esheet/core`).

The field renders the log newest first and offers no mutation affordances.

## Properties

None beyond the base field properties (`question` is used as the heading).

## Log Format (reserved `_activity` response key)

```json
{
  "activity": [
    {
      "id": "8f14e45f-...-guid",
      "at": "2026-01-01T10:00:00.000Z",
      "author": "Dr. Demo",
      "fieldId": "case-status",
      "question": "Case status",
      "from": "Open",
      "to": "Closed"
    }
  ]
}
```

`author` is stamped from the renderer `identity` prop when present.

## Example

```yaml
- id: activity-log
  fieldType: activity
  question: Activity
```
