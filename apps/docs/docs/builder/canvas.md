---
sidebar_position: 2
---

# Canvas & Drag-and-Drop

The Canvas is the central area of the builder where fields are displayed and can be reordered.

## Field Display

Each field on the canvas shows:

- **Question text** (or placeholder if blank)
- **Field type indicator**
- **Drag handle** (left side) for reordering
- **Remove button** (right side)
- **Preview rendering** of the field's input(s)
- **Selection highlight** (blue dashed border when selected)

## Adding Fields

Fields are added from the **ToolPanel** (left sidebar on desktop, bottom drawer on mobile). The ToolPanel groups field types by category:

| Category         | Field Types                                               |
| ---------------- | --------------------------------------------------------- |
| **Text**         | Text, Long Text, Multi Text                               |
| **Selection**    | Radio, Checkbox, Boolean, Dropdown, Multi-Select Dropdown |
| **Rating**       | Rating, Ranking, Slider                                   |
| **Matrix**       | Single Matrix, Multi Matrix                               |
| **Rich**         | Display, HTML, Image, Signature, Diagram                  |
| **Organization** | Section                                                   |

Clicking a field type button adds a new field of that type to:

- The **end of the form** if no section is selected
- The **end of the selected section** if a section is currently selected

## Drag-and-Drop Reordering

When `dragEnabled={true}` (default), fields can be reordered by dragging:

1. Grab the **drag handle** on the left side of any field
2. Drag up or down to reposition
3. Drop to place the field in its new position

The DnD system supports:

- **Root-level reordering** -- move fields within the main form
- **Section nesting** -- drag fields into or out of sections
- **Touch + mouse** -- works on both desktop and mobile devices

### Disabling Drag-and-Drop

For better performance on slow devices or when reordering isn't needed:

```tsx
<EsheetBuilder
  definition={myForm}
  onChange={handleChange}
  dragEnabled={false}
/>
```

## Field Selection

Click any field on the canvas to select it:

- Selected field gets a **blue dashed border**
- The **EditPanel** (right sidebar) opens to show that field's properties
- On mobile, tapping a field opens the EditPanel as a bottom drawer

Click the canvas background or a different field to change selection.

## Sections

Section fields are containers that can hold other fields:

- Sections render with a **title bar** and a bordered area for children
- Fields can be added directly into a section via the ToolPanel
- Sections support **recursive nesting** (sections inside sections)
- Conditional visibility applied to a section hides all children

## Sheets (Pages)

The Canvas header contains a **Sheets** bar that manages the form's pages. Every form has at least one sheet; adding a second sheet activates multi-page navigation in the renderer.

### Sheet controls

| Control          | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| Tab              | Shows the page title (default: "Sheet N"). Click to switch to that page.         |
| **+ Sheet**      | Appends a new blank page to the form.                                            |
| **Delete sheet** | Removes the active page and all its fields. Disabled when only one page remains. |
| Drag tab         | Drag a tab left or right to change page order.                                   |
| Double-click tab | Edit the page title inline.                                                      |
| ✎ pencil icon    | Opens inline title editing for the active tab.                                   |

When only one sheet exists the tab bar still renders, but no navigation UI appears in the renderer.

### Adding fields to a page

Fields added via the ToolPanel are placed on the **currently active page** (the selected sheet tab). Switching tabs and then adding a field places it on the newly active page.

## Conditional Visibility Preview

Fields with `visible` rules show/hide in real-time as you fill out the form in **Preview** mode. In **Build** mode, all fields are always shown (with a visual indicator for conditional fields where applicable).
