---
slug: /field-types/pages
---

# Pages

Pages are a built-in form structure that divides a form into multiple navigable sheets. Unlike field types such as `section`, pages are a **first-class form primitive** — they live at the top level of every form definition rather than inside the field tree.

Every form definition has a `pages` array. A form with a single page behaves identically to a traditional single-scroll form. A form with multiple pages gets automatic Previous / Next navigation in the renderer.

## Page Entry Properties

Each entry in the `pages` array has the following shape:

| Property      | Type                | Required | Description                                                                                                     |
| ------------- | ------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`            | Yes      | Unique identifier for this page                                                                                 |
| `title`       | `string`            | No       | Display label for the page (defaults to "Sheet N" in the builder)                                               |
| `autoAdvance` | `boolean`           | No       | Reserved — automatically advance to the next page when all fields are answered. Not yet active in the renderer. |
| `fields`      | `FieldDefinition[]` | No       | The fields rendered on this page. May include `section` fields to group questions.                              |

## Answer Format

Pages store no answers. All answers live on individual fields within each page's `fields` array.

## Schema Example

### Single-page form

A form with one page behaves exactly like a classic single-scroll form — no navigation UI is shown.

```json
{
  "id": "intake-form",
  "title": "Patient Intake",
  "pages": [
    {
      "id": "page_1",
      "title": "Demographics",
      "fields": [
        {
          "id": "first_name",
          "fieldType": "text",
          "question": "First Name",
          "required": true
        },
        {
          "id": "dob",
          "fieldType": "text",
          "question": "Date of Birth",
          "inputType": "date"
        }
      ]
    }
  ]
}
```

### Multi-page form

A form with two or more pages shows a navigation bar (← Previous · X / Y · Next →) at the bottom of the renderer.

```json
{
  "id": "intake-form",
  "title": "Patient Intake",
  "pages": [
    {
      "id": "page_1",
      "title": "Demographics",
      "fields": [
        {
          "id": "first_name",
          "fieldType": "text",
          "question": "First Name",
          "required": true
        }
      ]
    },
    {
      "id": "page_2",
      "title": "Medical History",
      "fields": [
        {
          "id": "allergies",
          "fieldType": "longtext",
          "question": "List any known allergies"
        }
      ]
    }
  ]
}
```

## Renderer Behavior

Implemented in [`RendererBody`](../../../packages/renderer/src/lib/components/RendererBody.tsx) and [`PageNavigator`](../../../packages/fields/src/lib/PageNavigator.tsx).

| Condition            | Behavior                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `pages.length === 1` | Fields render directly, no navigation UI shown                                               |
| `pages.length > 1`   | `PageNavigator` wraps the active page with a bottom bar: **← Previous · N / total · Next →** |
| First page           | "Previous" button is disabled                                                                |
| Last page            | "Next →" button is replaced with "Last page" text                                            |

Visibility rules (`rules`) on individual fields are evaluated per page — hidden fields are excluded from the rendered output on that page.

## Builder Behavior

The Canvas panel header displays a **Sheets** bar when pages are present.

- **Tabs**: each page appears as a labeled tab. Clicking switches the active page.
- **Add**: click **+ Sheet** to append a new blank page.
- **Delete**: click **Delete sheet** to remove the active page. Disabled when only one page remains (minimum 1 page enforced).
- **Reorder**: drag a tab left or right to change page order.
- **Rename**: double-click a tab, or click the ✎ pencil icon on the active tab, to edit the page title inline.

## Form Store API

These methods on `FormStore` manage pages programmatically:

```ts
// Add a new blank page (optionally with a title and insertion index)
form.getState().addPage({ title?: string; index?: number }): string

// Remove a page and all its fields. Returns false if only 1 page remains.
form.getState().removePage(pageId: string): boolean

// Move a page to a new index.
form.getState().movePage(pageId: string, toIndex: number): boolean

// Update a page's display title.
form.getState().updatePageTitle(pageId: string, title: string): boolean

// Set the auto-advance flag for a page (reserved; not yet active in renderer).
form.getState().setPageAutoAdvance(pageId: string, autoAdvance: boolean): boolean
```

## Constraints

- **Minimum 1 page**: `removePage` returns `false` and is a no-op when the form has only one page.
- **No nesting**: pages cannot be placed inside `section` fields or inside other pages. Pages exist exclusively at the form root level.
- **No field-level pages**: pages are not a `fieldType` — they cannot be added through the fields API (`addField`) and do not appear in the field toolbox.
