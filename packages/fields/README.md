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

Fields use Tailwind CSS v4 with `es:` prefix (e.g., `es:bg-essurface`, `es:text-estext`). Colors reference CSS custom properties (`--es-color-*`) defined by the host root:

- **Light mode**: Defined in the host's `@theme` block
- **Dark mode**: Overridden when the host root has `.dark` class

Fields do **not** ship their own CSS resets or dark theme — they inherit from the consuming package.

## Building

Run `nx build @esheet/fields` to build the library.

## Running unit tests

Run `nx test @esheet/fields` to execute the unit tests via [Vitest](https://vitest.dev/).
