import React from 'react';
import type { FieldComponentProps } from '@esheet/core';

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Wrap user-authored HTML in a minimal document shell that:
 *   - Sets UTF-8 charset and viewport meta
 *   - Applies a reset so content inherits page font / line-height
 *   - Does NOT inject theme variables (consumers write their own styles)
 *
 * The outer `<iframe sandbox="">` attribute already blocks script execution,
 * plug-ins, form submission, and navigation — so this wrapper is purely for
 * a clean rendering context, not additional security.
 */
function buildIframeDoc(html: string): string {
  if (!html) return '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 16px; font-family: inherit; font-size: inherit; line-height: 1.5; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

export const HtmlField = React.memo(function HtmlField({
  field,
  form,
  isPreview,
  onUpdate,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;

  const frameHeight = clamp(def.iframeHeight ?? 300, 50, 800);
  const [localHeight, setLocalHeight] = React.useState(frameHeight);

  // Keep local slider in sync if the stored value changes externally.
  React.useEffect(() => {
    setLocalHeight(clamp(def.iframeHeight ?? 300, 50, 800));
  }, [def.iframeHeight]);

  const commitHeight = (value: number) => {
    const h = clamp(value, 50, 800);
    setLocalHeight(h);
    onUpdate({ iframeHeight: h });
  };

  // --- Preview (display) mode ---
  if (isPreview) {
    return (
      <div className="html-field-preview">
        <iframe
          srcDoc={buildIframeDoc(def.htmlContent ?? '')}
          sandbox=""
          title="HTML content"
          style={{
            width: '100%',
            height: `${frameHeight}px`,
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // --- Edit (canvas) mode ---
  return (
    <div className="html-field-edit es:space-y-3">
      {/* HTML content textarea */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-html-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          HTML Content
        </label>
        <textarea
          id={`${instanceId}-canvas-html-${def.id}`}
          aria-label="HTML content"
          value={def.htmlContent ?? ''}
          onChange={(e) => onUpdate({ htmlContent: e.target.value })}
          placeholder="<p>Enter your HTML here...</p>"
          rows={8}
          spellCheck={false}
          className="html-field-textarea es:px-3 es:py-2 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors es:font-mono es:text-sm es:resize-y"
        />
      </div>

      {/* Preview height control */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-iframe-height-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          Preview Height (px)
        </label>
        <div className="es:flex es:items-center es:gap-2">
          <input
            type="range"
            min={50}
            max={800}
            step={10}
            value={localHeight}
            onChange={(e) => setLocalHeight(Number(e.target.value))}
            onMouseUp={(e) =>
              commitHeight(Number((e.target as HTMLInputElement).value))
            }
            onTouchEnd={(e) =>
              commitHeight(Number((e.target as HTMLInputElement).value))
            }
            aria-label="Preview height slider"
            className="es:flex-1 es:accent-esprimary es:cursor-pointer"
          />
          <input
            id={`${instanceId}-canvas-iframe-height-${def.id}`}
            type="number"
            min={50}
            max={800}
            step={10}
            value={localHeight}
            onChange={(e) => commitHeight(Number(e.target.value))}
            aria-label="Preview height in pixels"
            className="es:w-20 es:px-2 es:py-1 es:border es:border-esborder es:bg-essurface es:text-estext es:rounded es:text-sm es:text-center es:outline-none es:focus:border-esprimary"
          />
          <span className="es:text-sm es:text-estextmuted es:shrink-0">px</span>
        </div>
      </div>

      {/* Inline preview */}
      <div>
        <p className="es:text-xs es:font-medium es:text-estextmuted es:mb-1">
          Preview
        </p>
        <div className="es:rounded-lg es:border es:border-esborder es:overflow-hidden">
          <iframe
            srcDoc={buildIframeDoc(def.htmlContent ?? '')}
            sandbox=""
            title="HTML preview"
            style={{
              width: '100%',
              height: `${localHeight}px`,
              border: 'none',
              display: 'block',
              background: '#fff',
            }}
          />
        </div>
      </div>
    </div>
  );
});
