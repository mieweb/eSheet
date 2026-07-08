---
sidebar_position: 4
---

# Touch Mode

Touch mode provides larger, touch-friendly targets for form fields on mobile and tablet devices. It ensures a comfortable tap experience and prevents iOS zoom-on-focus by enforcing proper input sizing.

## Features

- **Auto-detection** — Automatically activates on viewports ≤979px
- **Manual control** — Programmatically enable/disable via props or ref methods
- **Override support** — User can toggle touch mode and override auto-detection
- **iOS zoom prevention** — 16px minimum font size on inputs prevents unwanted zoom

## Quick Start

```tsx
import { EsheetRenderer } from '@esheet/renderer';

// Auto-detect based on viewport
<EsheetRenderer formDataInput={formDef} touchMode="auto" />

// Always enable
<EsheetRenderer formDataInput={formDef} touchMode={true} />

// Rely on CSS media query only (default)
<EsheetRenderer formDataInput={formDef} />
```

## Props

| Prop                | Type                         | Default     | Description                      |
| ------------------- | ---------------------------- | ----------- | -------------------------------- |
| `touchMode`         | `boolean \| 'auto'`          | `undefined` | Control touch mode activation    |
| `onTouchModeChange` | `(enabled: boolean) => void` | —           | Callback when touch mode changes |

### `touchMode` Options

| Value       | Behavior                                                     |
| ----------- | ------------------------------------------------------------ |
| `true`      | Always enable touch mode                                     |
| `false`     | Never enable via JS (CSS media query still applies)          |
| `'auto'`    | Enable based on viewport width (≤979px). Responds to resize. |
| `undefined` | Rely on CSS media query only (default)                       |

## Ref Methods

Access these via a ref to `EsheetRenderer`:

```tsx
const rendererRef = useRef<EsheetRendererHandle>(null);

// Check if touch mode is enabled
const isEnabled = rendererRef.current?.isTouchModeEnabled();

// Toggle touch mode (only works with touchMode="auto" or undefined)
rendererRef.current?.setTouchMode(true); // Enable
rendererRef.current?.setTouchMode(false); // Disable

// Reset to auto-detection (only works with touchMode="auto")
rendererRef.current?.resetTouchMode();
```

| Method                  | Returns   | Description                                        |
| ----------------------- | --------- | -------------------------------------------------- |
| `isTouchModeEnabled()`  | `boolean` | Current touch mode state                           |
| `setTouchMode(enabled)` | `void`    | Manually enable/disable. Overrides auto-detection. |
| `resetTouchMode()`      | `void`    | Clear manual override, return to auto-detection    |

## Example: Custom Toggle Button

```tsx
import { useRef, useState } from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';

function FormWithTouchToggle({ formDef }) {
  const rendererRef = useRef<EsheetRendererHandle>(null);
  const [touchEnabled, setTouchEnabled] = useState(false);

  return (
    <div>
      <button
        onClick={() => rendererRef.current?.setTouchMode(!touchEnabled)}
        className={touchEnabled ? 'bg-primary' : 'bg-gray-200'}
      >
        {touchEnabled ? '📱 Touch Mode ON' : '🖥️ Touch Mode OFF'}
      </button>

      <EsheetRenderer
        ref={rendererRef}
        formDataInput={formDef}
        touchMode="auto"
        onTouchModeChange={setTouchEnabled}
      />
    </div>
  );
}
```

## Behavior Matrix

| `touchMode` | Viewport | Manual Override | Result                                  |
| ----------- | -------- | --------------- | --------------------------------------- |
| `true`      | Any      | N/A             | Touch mode ON                           |
| `false`     | ≤979px   | N/A             | CSS applies touch styles                |
| `false`     | >979px   | N/A             | Normal styling                          |
| `'auto'`    | ≤979px   | No              | Touch mode ON                           |
| `'auto'`    | >979px   | No              | Touch mode OFF                          |
| `'auto'`    | Any      | Enabled         | Touch mode ON (ignores viewport)        |
| `'auto'`    | Any      | Disabled        | Touch mode OFF (blocks CSS media query) |

## What Touch Mode Changes

| Element              | Normal         | Touch Mode                    |
| -------------------- | -------------- | ----------------------------- |
| **Inputs/textareas** | Default height | 48px min-height, 16px font    |
| **Radio/checkbox**   | Default size   | 1.75× scale                   |
| **Labels**           | Default size   | 44px min-height, flex-aligned |
| **Buttons**          | Default size   | 44px min-height               |

## CSS Classes

The renderer applies these classes to its root element:

| Class                   | When Applied                             |
| ----------------------- | ---------------------------------------- |
| `.esheet-renderer-root` | Always                                   |
| `.esheet-touch-active`  | When touch mode is enabled via JS        |
| `.touch-mode-disabled`  | When user manually disables in auto mode |

You can use these classes for custom styling if needed.

## Best Practices

1. **Use `touchMode="auto"` for most cases** — It provides the best experience across devices
2. **Sync external UI** — Use `onTouchModeChange` to keep toggle buttons in sync
3. **Test on real devices** — Touch targets should be tested on actual mobile devices
4. **Don't force touch mode on desktop** — Let users control it if they prefer larger targets
