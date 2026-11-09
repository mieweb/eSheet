# @esheet/fields

**Internal** field component library for eSheet. Provides the 19 built-in field type React components used by `@esheet/builder` and `@esheet/renderer`.

> **⚠️ Not intended for standalone use.** These components expect to run inside a host root (`@esheet/builder` or `@esheet/renderer`) that provides CSS resets, theme tokens, and dark mode support. Without a host, components will render unstyled.

## Field Types

| Category   | Components                                                                  |
| ---------- | --------------------------------------------------------------------------- |
| **Text**   | `TextField`, `LongTextField`, `MultiTextField`                              |
| **Choice** | `RadioField`, `CheckField`, `BooleanField`                                  |
| **Select** | `DropdownField`, `MultiSelectDropdownField`                                 |
| **Scale**  | `RatingField`, `RankingField`, `SliderField`                                |
| **Matrix** | `SingleMatrixField`, `MultiMatrixField`                                     |
| **Rich**   | `DisplayField`, `HtmlField`, `ImageField`, `SignatureField`, `DiagramField` |
| **Layout** | `SectionField`                                                              |

## Shared Components

Date and datetime fields use the browser's regional language preference for
display (and date entry) through `DateInput.locale`. Date answers remain ISO
`YYYY-MM-DD`; relative date bounds and calendar selection keep the existing
US-order control-value contract. Incomplete or invalid date drafts block
validation and submission until corrected or cleared; draft errors are transient
and never exported with responses. Document-list date columns and addendum
dates use the same regional formatter without changing stored rows or sort
keys. The development UI source override requires a sibling `ui` checkout;
build that package before building these fields.

- `CustomRadio` — Themed radio with unselect support
- `CustomCheckbox` — Themed checkbox
- `CustomDropdown` — Themed select dropdown
- `DrawingPad` — Canvas component (used by SignatureField/DiagramField)
- Icons: `TrashIcon`, `PlusIcon`, `ArrowUpIcon`, `ArrowDownIcon`, `UpDownArrowIcon`

## Component Registry

```ts
import { getFieldComponent, registerCustomFieldTypes } from '@esheet/fields';

// Look up a component by field type
const Component = getFieldComponent('text'); // → TextField

// Register custom field types
registerCustomFieldTypes({
  'my-custom': {
    component: MyCustomField,
    meta: {
      type: 'my-custom',
      label: 'Custom',
      category: 'basic',
      defaultProps: {},
    },
  },
});
```

## CSS Architecture

Fields use Tailwind CSS v4 with an `ms:` prefix (for example, `ms:bg-mssurface` and `ms:text-mstext`). `@esheet/styles` loads the shared utility set automatically and maps `@mieweb/ui` brand variables to eSheet semantic colors.

Applications must load `@mieweb/ui/styles.css` and select a brand stylesheet. The shared eSheet stylesheet uses fallback colors when brand variables are unavailable.

## Autocomplete recovery

Autocomplete fields retain loaded selections and choices picked during the current
form session, including their captured attributes. If a choice disappears from the
source, it remains selectable after clearing or changing the input, even below the
source's minimum search length. Retained choices are labeled “Previously selected”;
a successful complete-list provider can confirm removal and labels them “No longer
active” instead. Live source results take precedence over retained copies.

Recovery is scoped to the form instance and field, survives page/tab changes, and
uses core's runtime extensions rather than exported responses, browser storage, or
server history. Loading another definition or disposing the form clears it. Another
record never inherits these choices; reopening starts from its saved selection.
Hosts can opt into a longer recovery lifetime by restoring and subscribing to
`AUTOCOMPLETE_HISTORY_NAMESPACE` extensions (per-field arrays of retained items).
The host must scope persistence by identity and record and handle logout cleanup;
eSheet itself does not write browser storage.

## Building

Run `pnpm --filter @esheet/fields build` to build the library.

## Running unit tests

Run `pnpm --filter @esheet/fields test` to execute the unit tests via [Vitest](https://vitest.dev/).
