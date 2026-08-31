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
`_activity` response key, so concurrent logs union-merge by entry ID
(`mergeActivity` from `@esheet/core`).

The field renders the log newest first in a sortable, filterable DataVis grid
and offers no response mutation affordances. Register the Activity UI plugin
before parsing or rendering forms that contain an activity field:

```ts
import { registerActivityFieldType } from '@esheet/fields-documents';

registerActivityFieldType();
```

Activity recording remains part of `@esheet/core`; registration supplies the
builder and renderer component.

## Grid Columns

- **Date / Time** — localized entry timestamp;
- **Field** — the recorded question, falling back to the field ID;
- **Category** — `Added`, `Updated`, or `Cleared`, derived from the previous
  and current values;
- **Previous Value** — display value before the change;
- **Current Value** — display value after the change;
- **Author** — renderer identity when available.

Long values stay compact in the grid. Use **Detail** to expand the complete
before-and-after values for each row. On narrow screens, the grid scrolls
horizontally rather than switching to a different representation.

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
