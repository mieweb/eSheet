---
sidebar_position: 4
---

# Theming & Styling

eSheet uses **Tailwind CSS v4** with a scoped `ms:` prefix and semantic color tokens. This ensures styles don't leak into or conflict with your host application.

## How Styling Works

All eSheet components use Tailwind utility classes prefixed with `ms:`. For example:

```html
<!-- eSheet internal markup -->
<div class="ms:flex ms:gap-2 ms:p-4 ms:bg-mssurface ms:text-mstext"></div>
```

`@esheet/styles` compiles all eSheet utilities into one stylesheet and loads it automatically through the builder, renderer, and fields packages. You don't need to configure Tailwind in your own project to use eSheet.

eSheet components also use `@mieweb/ui`. Applications must load the compiled UI stylesheet and select a brand separately:

```css
@import '@mieweb/ui/brands/bluehive.css' layer(theme);
@import '@mieweb/ui/styles.css';
```

## Semantic Color Tokens

eSheet uses semantic color tokens instead of hardcoded color values. These tokens are defined as CSS custom properties and can be overridden:

| Token                   | Default        | Usage                                             |
| ----------------------- | -------------- | ------------------------------------------------- |
| `msprimary`             | Blue (#2563eb) | Primary actions, selected states, active elements |
| `mssecondary`           | Gray           | Secondary elements                                |
| `msaccent`              | Green          | Success states                                    |
| `msdanger`              | Red (#ef4444)  | Destructive actions, errors, validation           |
| `mswarning`             | Orange         | Warning indicators                                |
| `mssurface`             | White          | Card/panel backgrounds                            |
| `msborder`              | Gray-200       | Border colors                                     |
| `msborderinactive`      | Gray-400       | Unchecked input borders                           |
| `mstext`                | Gray-900       | Primary text                                      |
| `mstextsecondary`       | Slate-50       | Text on primary backgrounds                       |
| `mstextmuted`           | Gray-500       | Secondary/muted text                              |
| `msbackground`          | Gray-50        | Page/section backgrounds                          |
| `msbackgroundsecondary` | Gray-100       | Section backgrounds                               |
| `msbackgroundhover`     | Gray-150       | Hover states                                      |
| `msoverlay`             | Black/50       | Modal backdrop overlay                            |

## Customizing Colors

Override the underlying `@mieweb/ui` CSS custom properties in your stylesheet:

```css
/* Override eSheet's primary color to green */
:root {
  --mieweb-primary-500: #059669;
  --mieweb-destructive: #dc2626;
  --mieweb-card: #fefefe;
}
```

## Responsive Design

eSheet is responsive out of the box:

- **Desktop** (lg+): Builder shows 3-column layout (Toolbox | Canvas | Editor)
- **Tablet/Mobile**: Builder collapses to single-column with bottom-sheet drawers for the toolbox and editor
- **Renderer**: Single-column layout that adapts to available width (max-width: `42rem`)

## Container Requirements

### Builder

The builder fills its parent container. Ensure the parent has explicit dimensions:

```tsx
{/* [OK] Good -- explicit height */}
<div style={{ height: '100vh' }}>
  <EsheetBuilder ... />
</div>

{/* [X] Bad -- no height means builder collapses */}
<div>
  <EsheetBuilder ... />
</div>
```

### Renderer

The renderer is self-sizing and flows naturally in document layout. It constrains itself to `max-width: 42rem` and centers horizontally.
