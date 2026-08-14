---
slug: /field-types/notes
---

# notes

Journal-style list of rich (markdown) note entries — progress notes,
correspondence logs, comments. Each entry carries a stable GUID, timestamps,
an optional author (stamped from the renderer `identity` prop), a raw-markdown
body, and optional file attachments.

Because entries are GUID-keyed, `notes[]` merges as a **set keyed by `id`**,
not a positional array: concurrent adds from two clients union cleanly, and
same-entry edit conflicts resolve last-writer-wins on
`updatedAt ?? createdAt`. Hosts with CRDT bindings should call `mergeNotes`
from `@esheet/core` when both sides changed the field.

## Properties

- `allowAttachments`: Allow file/image attachments per note (default `false`)
- `accept`: Accept string for the attachment input (same semantics as `file`)
- `maxFileSize`: Maximum attachment size in bytes
- `maxAttachments`: Maximum attachments per note
- `maxNotes`: Maximum number of entries
- `sortOrder`: `newest` (default) or `oldest`
- `entryLabel`: Label for one entry, e.g. `Note`, `Letter`, `Comment`
  (default `Note`)

`required` means the field must contain at least one entry.

## Answer Format

```json
{
  "notes": [
    {
      "id": "8f14e45f-...-guid",
      "createdAt": "2026-01-01T10:00:00.000Z",
      "updatedAt": "2026-01-02T09:00:00.000Z",
      "author": "Dr. Demo",
      "markdown": "Patient reports *improvement*.",
      "attachments": [
        { "contentType": "application/pdf", "dataUrl": "data:...", "title": "report.pdf", "size": 2048 }
      ]
    }
  ]
}
```

## Example

```yaml
- id: case-notes
  fieldType: notes
  question: Case notes
  entryLabel: Note
  allowAttachments: true
  accept: image/*,.pdf
  maxAttachments: 3
  sortOrder: newest
  required: true
```

## Authorship and edit policy

Pass `identity={{ name: 'Dr. Demo' }}` to `EsheetRenderer` to stamp new
entries' `author`; without it, entries save unstamped. Who may edit or delete
a note is **host policy, not field policy**: the field records
`author`/`createdAt`/`updatedAt` and respects an optional
`canModify(note) => boolean` hook on the definition, but enforcement belongs
server-side (the GUID-keyed shape makes rejecting non-author mutations a
per-entry diff).

## Attachments in host pipelines

Hosts that externalize attachment bytes should use `collectAttachments` /
`mapAttachments` from `@esheet/core` instead of hardcoding `fileData` — they
traverse both file-field and notes-field attachments.
