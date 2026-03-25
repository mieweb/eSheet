---
sidebar_position: 3
---

# Field Editing

When a field is selected on the canvas, the **EditPanel** opens on the right side (desktop) or as a bottom drawer (mobile). The EditPanel has two tabs: **Edit** and **Logic**.

## Edit Tab

### Common Properties

Every field type has these editable properties:

| Property     | Description                                 |
| ------------ | ------------------------------------------- |
| **Question** | The label/question text shown to the user   |
| **Required** | Whether the field must be answered (toggle) |

### Type-Specific Properties

Additional properties appear based on the field type:

#### Text Fields (`text`)

| Property   | Editor                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| Input Type | Dropdown: string, number, email, tel, date, datetime-local, month, time, url |
| Unit       | Text input for suffix (e.g. "kg", "cm")                                      |

#### Choice Fields (`radio`, `check`, `dropdown`, `multiselectdropdown`)

| Property | Editor                                              |
| -------- | --------------------------------------------------- |
| Options  | Editable list -- add, edit, delete, reorder options |

The **Option List Editor** provides:

- Text input per option to edit the value
- **Add** button to append a new option
- **Delete** button per option to remove it
- New fields start with 3 placeholder options

#### Multi Text (`multitext`)

| Property | Editor                                               |
| -------- | ---------------------------------------------------- |
| Options  | Each option becomes a labeled text input in the form |

#### Rating (`rating`)

| Property | Editor                                |
| -------- | ------------------------------------- |
| Options  | Numeric scale values (e.g. 1-5, 1-10) |

#### Ranking (`ranking`)

| Property | Editor                              |
| -------- | ----------------------------------- |
| Options  | Items that users will drag to order |

#### Slider (`slider`)

| Property | Editor                                 |
| -------- | -------------------------------------- |
| Options  | Range values (first = min, last = max) |

#### Matrix Fields (`singlematrix`, `multimatrix`)

| Property | Editor                          |
| -------- | ------------------------------- |
| Rows     | Editable list of row labels     |
| Columns  | Editable list of column headers |

The **Matrix Editor** provides:

- Separate sections for rows and columns
- Add, edit, delete for each row/column
- New matrix fields start with 3 rows and 3 columns

#### Section (`section`)

| Property | Editor               |
| -------- | -------------------- |
| Title    | Section heading text |

#### HTML (`html`)

| Property     | Editor                 |
| ------------ | ---------------------- |
| HTML Content | Text area for raw HTML |

#### Image (`image`)

| Property  | Editor                      |
| --------- | --------------------------- |
| Image URI | URL of the image            |
| Alt Text  | Accessible alternative text |
| Caption   | Caption below the image     |

#### Display (`display`)

| Property | Editor                                                              |
| -------- | ------------------------------------------------------------------- |
| Content  | Markdown text area (supports `{fieldId}` and `<expression>` syntax) |

#### Signature / Diagram (`signature`, `diagram`)

| Property    | Editor                           |
| ----------- | -------------------------------- |
| Placeholder | Text shown on the drawing canvas |

## Logic Tab

The Logic tab lets you configure **conditional rules** for the selected field. See the [Conditional Logic](../conditional-logic) reference for full details.

### Rule Builder UI

The Logic tab provides a visual rule builder:

1. **Add Rule** -- Creates a new conditional rule
2. **Effect** -- Choose `visible`, `enable`, or `required`
3. **Logic Mode** -- Toggle between `AND` (all must match) and `OR` (any can match)
4. **Conditions** -- Add one or more conditions per rule:

- **Condition Type** -- `field` (compare field value) or `expression` (custom expression)
- For field conditions:
- **Target Field** -- Select which field to evaluate
- **Operator** -- Choose comparison (equals, contains, etc.)
- **Expected Value** -- The value to compare against
- **Property Accessor** -- Optional (length, count)
- For expression conditions:
- **Expression** -- JavaScript-like expression with `{fieldId}` references

### Multiple Rules

You can add multiple rules for different effects on the same field. For example:

- Rule 1: `visible` when payment method = "Credit Card"
- Rule 2: `required` when checkout step = "Payment"

## How Changes Are Saved

Every edit in the EditPanel immediately updates the **FormStore**. If an `onChange` callback is provided to the builder, it fires after each change with the updated `FormDefinition`.

There is no manual "save" action -- changes are applied in real-time.
