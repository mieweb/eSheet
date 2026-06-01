---
sidebar_position: 6
---

# Touch Mode

Touch mode provides larger, touch-friendly targets for form fields in the builder's **preview mode**. It ensures a comfortable tap experience when testing forms on mobile devices.

## Key Difference from Renderer

In the builder, touch mode **only affects preview mode** — not the build canvas, tool panel, or edit panel. This ensures the editing interface remains unchanged while previewing how forms will appear on touch devices.

## Built-in Toggle

The builder includes a toggle switch in preview mode:

```
┌──────────────────────────────────────────┐
│  Preview Mode                            │
│                        ○ Touch Mode      │  ← Built-in toggle
├──────────────────────────────────────────┤
│                                          │
│  [Form fields with touch styling]        │
│                                          │
└──────────────────────────────────────────┘
```

No configuration needed — the toggle appears automatically in preview mode.

## Programmatic Control

For advanced use cases, you can control touch mode via props and ref methods.

### Props

| Prop                | Type                         | Default     | Description                      |
| ------------------- | ---------------------------- | ----------- | -------------------------------- |
| `touchMode`         | `boolean \| 'auto'`          | `undefined` | Control touch mode activation    |
| `onTouchModeChange` | `(enabled: boolean) => void` | —           | Callback when touch mode changes |

### `touchMode` Options

| Value       | Behavior                                               |
| ----------- | ------------------------------------------------------ |
| `true`      | Always enable touch mode in preview                    |
| `false`     | Never enable via JS (CSS media query still applies)    |
| `'auto'`    | Auto-detect based on viewport width (≤979px)           |
| `undefined` | Use built-in toggle, rely on CSS media query (default) |

### Ref Methods

```tsx
import { useRef } from 'react';
import { EsheetBuilder, type EsheetBuilderHandle } from '@esheet/builder';

function MyBuilder() {
  const builderRef = useRef<EsheetBuilderHandle>(null);

  const enableTouchMode = () => {
    builderRef.current?.setTouchMode(true);
  };

  return (
    <EsheetBuilder ref={builderRef} definition={formDef} touchMode="auto" />
  );
}
```

| Method                  | Returns   | Description              |
| ----------------------- | --------- | ------------------------ |
| `isTouchModeEnabled()`  | `boolean` | Current touch mode state |
| `setTouchMode(enabled)` | `void`    | Manually enable/disable  |
| `resetTouchMode()`      | `void`    | Reset to auto-detection  |

## Example: External Toggle

If you want to add an external touch mode toggle (e.g., in a toolbar):

```tsx
import { useRef, useState } from 'react';
import { EsheetBuilder, type EsheetBuilderHandle } from '@esheet/builder';

function BuilderWithExternalToggle() {
  const builderRef = useRef<EsheetBuilderHandle>(null);
  const [touchEnabled, setTouchEnabled] = useState(false);

  return (
    <div>
      <header>
        <button onClick={() => builderRef.current?.setTouchMode(!touchEnabled)}>
          {touchEnabled ? 'Disable Touch Mode' : 'Enable Touch Mode'}
        </button>
      </header>

      <EsheetBuilder
        ref={builderRef}
        definition={formDef}
        touchMode="auto"
        onTouchModeChange={setTouchEnabled}
      />
    </div>
  );
}
```

## What Touch Mode Changes (Preview Only)

| Element              | Normal         | Touch Mode                 |
| -------------------- | -------------- | -------------------------- |
| **Inputs/textareas** | Default height | 48px min-height, 16px font |
| **Radio/checkbox**   | Default size   | 1.75× scale                |
| **Field labels**     | Default size   | 44px min-height, 1rem font |

**Note:** Unlike the renderer, buttons in the builder are not affected by touch mode to prevent changing UI control sizes.

## Scoping

Touch mode styles are scoped to `.preview-layout` only:

```
Builder Root
├── Header (unaffected)
├── Build Mode
│   ├── Tool Panel (unaffected)
│   ├── Canvas (unaffected)
│   └── Edit Panel (unaffected)
├── Code Mode (unaffected)
└── Preview Mode
    └── Form Fields (TOUCH MODE APPLIES HERE)
```

## Best Practices

1. **Let users discover the built-in toggle** — Most users will find it in preview mode
2. **Use `touchMode="auto"` for responsive testing** — Automatically activates on mobile
3. **Don't override in simple cases** — The default behavior (CSS media query + toggle) is usually sufficient
